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

## Current Status (Updated 2026-03-08)

**All Waves 1-6 are COMPLETE.** See `tasks/done/` for completed work.

**Recent Fixes (2026-03-08):**
- Fixed test mock paths (db vs db-stub mismatch)
- Restored auth middleware from _archived (was stub returning 501)
- Restored auth routes from _archived  
- Fixed async/await for createNewApiKey in auth routes
- Fixed error classes in user service (ValidationError, UnauthorizedError)
- All 138 tests now passing

**Project Ready For:**
- Deployment to HYPR platform (app slug: `talk`)
- Configure secrets in HYPR dashboard (ELEVENLABS_API_KEY, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET)
- Test production deployment

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