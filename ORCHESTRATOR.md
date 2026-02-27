# Agent-Talk Task Orchestrator

You are the orchestrator for the agent-talk project. Your job is to start parallel work on tasks.

## CRITICAL: You MUST spawn sub-agents

Use the `sessions_spawn` tool to spawn sub-agents for tasks. This is the PRIMARY function.

## Step 1: Check Current State

Read these directories:
- `tasks/todos/` - tasks ready to start
- `tasks/in-progress/` - tasks currently being worked on
- `tasks/done/` - completed tasks

## Step 2: Identify Ready Tasks

A task is READY if:
1. It's in `tasks/todos/`
2. It has `project: agent-talk` or contains `agent-talk` in the filename
3. ALL dependencies (in `depends_on`) are in `tasks/done/`

## Step 3: Spawn Agents (UP TO 5)

For each ready task, use `sessions_spawn` with mode="run":

```json
{
  "task": "Read and complete the task at /Users/mastercontrol/.openclaw/workspace/tasks/todos/task-XXX.md. Follow all acceptance criteria. Move the task to done/ when complete.",
  "mode": "run",
  "runTimeoutSeconds": 600
}
```

## Current Ready Tasks (No Dependencies)

These can be started immediately:
- **task-137** (Database) - HIGH - File: `tasks/todos/task-137-agent-talk-database.md`
- **task-134** (Auth) - HIGH - File: `tasks/todos/task-134-agent-talk-auth.md`
- **task-150** (Error Handling) - MEDIUM - File: `tasks/todos/task-150-agent-talk-error-handling.md`

## Dependency Chain

```
Wave 1 (no deps): task-137, task-134, task-150
Wave 2: task-135 (needs 134), task-151 (needs 134+135)
Wave 3: task-136 (needs 135), task-139 (needs 135), task-140 (needs 134+135), task-143 (needs 135), task-146 (needs 135)
Wave 4: task-138 (needs 136), task-141 (needs 139), task-145 (needs 134+135+136+137)
... and so on
```

## Step 4: Report

After spawning, report:
1. How many agents spawned
2. Which tasks they're working on
3. What tasks are blocked waiting for dependencies

## Example Spawn Command

When you use sessions_spawn, it looks like this:

```
sessions_spawn with:
- task: "Read /Users/mastercontrol/.openclaw/workspace/tasks/todos/task-137-agent-talk-database.md and complete ALL acceptance criteria. This is a HIGH priority task for the agent-talk project. Location: /Users/mastercontrol/.openclaw/workspace/agent-talk"
- mode: "run"
- runTimeoutSeconds: 600
```

DO THIS FOR UP TO 5 READY TASKS RIGHT NOW.