#!/usr/bin/env python3
"""
Agent-Talk Task Orchestrator

Reads tasks from the tasks/ folder and spawns sub-agents to complete them.
Respects dependencies and runs up to 5 tasks in parallel.
"""

import os
import json
import re
import subprocess
import sys
from pathlib import Path
from datetime import datetime
from typing import Optional

# Paths
WORKSPACE = Path("/Users/mastercontrol/.openclaw/workspace")
AGENT_TALK = WORKSPACE / "agent-talk"
TASKS_DIR = WORKSPACE / "tasks"
TODOS_DIR = TASKS_DIR / "todos"
IN_PROGRESS_DIR = TASKS_DIR / "in-progress"
DONE_DIR = TASKS_DIR / "done"
ORCHESTRATOR_STATE = AGENT_TALK / ".orchestrator.json"
LOG_FILE = AGENT_TALK / "orchestrator.log"

# Max parallel agents
MAX_PARALLEL = 5

def log(message: str):
    """Log message with timestamp."""
    timestamp = datetime.now().isoformat()
    log_line = f"[{timestamp}] {message}"
    print(log_line)
    with open(LOG_FILE, "a") as f:
        f.write(log_line + "\n")

def parse_task_frontmatter(content: str) -> dict:
    """Parse YAML frontmatter from task file."""
    match = re.match(r'^---\n(.*?)\n---', content, re.DOTALL)
    if not match:
        return {}
    
    frontmatter = {}
    for line in match.group(1).split('\n'):
        if ':' in line:
            key, value = line.split(':', 1)
            key = key.strip()
            value = value.strip()
            
            # Parse lists
            if value.startswith('[') and value.endswith(']'):
                items = value[1:-1].split(',')
                frontmatter[key] = [item.strip() for item in items if item.strip()]
            elif value.lower() == 'true':
                frontmatter[key] = True
            elif value.lower() == 'false':
                frontmatter[key] = False
            else:
                frontmatter[key] = value
    return frontmatter

def read_task(filepath: Path) -> dict:
    """Read a task file and return structured data."""
    content = filepath.read_text()
    frontmatter = parse_task_frontmatter(content)
    
    # Parse dependencies - handle both list and string formats
    depends_on = frontmatter.get('depends_on', [])
    if isinstance(depends_on, str):
        if depends_on == '[]' or depends_on == '':
            depends_on = []
        else:
            # Single dependency as string
            depends_on = [depends_on]
    
    return {
        'filepath': filepath,
        'id': frontmatter.get('id', filepath.stem),
        'priority': frontmatter.get('priority', 'medium'),
        'status': frontmatter.get('status', 'todo'),
        'depends_on': depends_on,
        'title': get_task_title(content),
        'project': frontmatter.get('project', ''),
        'content': content
    }

def get_task_title(content: str) -> str:
    """Extract title from task content."""
    match = re.search(r'^# (.+)$', content, re.MULTILINE)
    return match.group(1) if match else "Untitled"

def get_task_status(task_id: str) -> str:
    """Check which folder a task is in."""
    for status, folder in [('todo', TODOS_DIR), ('in-progress', IN_PROGRESS_DIR), ('done', DONE_DIR)]:
        for f in folder.glob('*.md'):
            if task_id in f.name:
                return status
    return 'unknown'

def get_all_tasks() -> list:
    """Get all tasks from all folders."""
    tasks = []
    
    # Read todos
    for f in TODOS_DIR.glob('*.md'):
        task = read_task(f)
        task['status'] = 'todo'
        tasks.append(task)
    
    # Read in-progress
    for f in IN_PROGRESS_DIR.glob('*.md'):
        task = read_task(f)
        task['status'] = 'in-progress'
        tasks.append(task)
    
    return tasks

def check_dependencies_met(task: dict, completed_tasks: set) -> bool:
    """Check if all dependencies are completed."""
    if not task.get('depends_on'):
        return True
    
    for dep in task['depends_on']:
        if dep and dep not in completed_tasks:
            return False
    return True

def spawn_agent(task: dict) -> dict:
    """Spawn a sub-agent to work on a task."""
    task_id = task['id']
    task_file = task['filepath']
    
    log(f"Spawning agent for {task_id}: {task['title']}")
    
    # Move task to in-progress
    dest = IN_PROGRESS_DIR / task_file.name
    if task_file.exists():
        import shutil
        shutil.move(str(task_file), str(dest))
        log(f"Moved {task_id} to in-progress")
    
    # Build the prompt for the sub-agent
    prompt = f"""You are working on task {task_id}: {task['title']}

## Task File Location
{dest}

## Your Mission
Read the task file at the location above and complete ALL acceptance criteria.

## Task Content
{task['content']}

## Instructions
1. Read the full task file for complete context
2. Implement all the required functionality
3. Run the verification commands to ensure everything works
4. Once ALL acceptance criteria are met, move the task file to the done folder:
   `mv {dest} {DONE_DIR / task_file.name}`
5. Report what you completed

## Project Context
- Project: agent-talk (Text-to-speech API for AI agents)
- Location: {AGENT_TALK}
- Tech stack: Vite + Svelte (frontend), Hono (backend), ElevenLabs/Edge TTS

## Important
- Do NOT skip any acceptance criteria
- Run the verification commands to confirm functionality
- Only mark done when ALL criteria pass
"""
    
    # Use sessions_spawn to create a sub-agent
    try:
        result = subprocess.run(
            ['openclaw', 'agent', 'spawn', '--task', prompt],
            capture_output=True,
            text=True,
            timeout=30
        )
        log(f"Spawn result: {result.stdout}")
        if result.returncode != 0:
            log(f"Spawn error: {result.stderr}")
        return {'success': result.returncode == 0, 'task_id': task_id}
    except Exception as e:
        log(f"Failed to spawn agent: {e}")
        return {'success': False, 'error': str(e)}

def get_orchestrator_state() -> dict:
    """Load orchestrator state."""
    if ORCHESTRATOR_STATE.exists():
        return json.loads(ORCHESTRATOR_STATE.read_text())
    return {
        'last_run': None,
        'active_agents': [],
        'completed_tasks': []
    }

def save_orchestrator_state(state: dict):
    """Save orchestrator state."""
    ORCHESTRATOR_STATE.write_text(json.dumps(state, indent=2))

def main():
    log("=" * 60)
    log("Agent-Talk Task Orchestrator Starting")
    log("=" * 60)
    
    # Ensure directories exist
    for d in [TODOS_DIR, IN_PROGRESS_DIR, DONE_DIR]:
        d.mkdir(parents=True, exist_ok=True)
    
    # Load state
    state = get_orchestrator_state()
    completed_tasks = set(state.get('completed_tasks', []))
    
    # Also check done folder
    for f in DONE_DIR.glob('*.md'):
        task_id = f.stem.replace('task-', '').split('-')[0]
        completed_tasks.add(f'task-{task_id}')
    
    # Get all pending tasks
    all_tasks = get_all_tasks()
    log(f"Found {len(all_tasks)} tasks")
    
    # Filter to agent-talk project tasks only
    agent_talk_tasks = [t for t in all_tasks if t.get('project') == 'agent-talk' or 'agent-talk' in t['id']]
    log(f"Found {len(agent_talk_tasks)} agent-talk tasks")
    
    # Find tasks ready to run (todo status, dependencies met)
    ready_tasks = []
    for task in agent_talk_tasks:
        if task['status'] != 'todo':
            continue
        if check_dependencies_met(task, completed_tasks):
            ready_tasks.append(task)
    
    # Sort by priority (high -> medium -> low)
    priority_order = {'high': 0, 'medium': 1, 'low': 2}
    ready_tasks.sort(key=lambda t: priority_order.get(t.get('priority', 'medium'), 1))
    
    log(f"Found {len(ready_tasks)} tasks ready to run")
    
    # Limit to MAX_PARALLEL
    tasks_to_spawn = ready_tasks[:MAX_PARALLEL]
    
    if not tasks_to_spawn:
        log("No tasks to spawn. All caught up!")
        return
    
    log(f"Spawning {len(tasks_to_spawn)} agents...")
    
    # Report what we're about to do
    for i, task in enumerate(tasks_to_spawn, 1):
        log(f"  {i}. {task['id']}: {task['title']}")
    
    # Spawn agents (they'll run asynchronously)
    for task in tasks_to_spawn:
        result = spawn_agent(task)
        if result.get('success'):
            state['active_agents'].append({
                'task_id': task['id'],
                'spawned_at': datetime.now().isoformat()
            })
    
    # Save state
    state['last_run'] = datetime.now().isoformat()
    save_orchestrator_state(state)
    
    log(f"Orchestration complete. {len(tasks_to_spawn)} agents spawned.")

if __name__ == '__main__':
    main()