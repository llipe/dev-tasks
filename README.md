# dev-tasks

A set of instructions for GitHub Copilot and other AI coding agents to emulate a PRD and task-based development workflow, inspired by [snarktank/ai-dev-tasks](https://github.com/snarktank/ai-dev-tasks).

## ✨ The Core Idea

This workflow brings structure and clarity to AI-assisted development by:

- Defining scope with a Product Requirement Document (PRD)
- Breaking down the PRD into actionable tasks
- Guiding the AI to tackle one task at a time, with checkpoints for review and approval

## 📋 Workflow Overview

1. **Create a PRD**: Use `instructions/create-prd.instructions.md` to guide the AI in generating a detailed PRD for your feature.
2. **Generate Tasks**: Use `instructions/generate-tasks.instructions.md` to break the PRD into a step-by-step implementation plan.
3. **Process Task List**: Use `instructions/process-task-list.instructions.md` to instruct the AI to work through tasks one at a time, marking completion and waiting for user approval before proceeding.

## 🗂️ Files

- `instructions/create-prd.instructions.md`: PRD generation instructions
- `instructions/generate-tasks.instructions.md`: Task list generation instructions
- `instructions/process-task-list.instructions.md`: Task processing and completion protocol

## 🌟 Benefits

- Structured, step-by-step development
- Review and approve each change
- Manages complexity and improves reliability
- Clear progress tracking

## 🛠️ How to Use

1. Clone or copy these instruction files into your project
2. Reference them in your AI tool or workflow
3. Follow the workflow: PRD → Tasks → Process

## 💡 Tips

- Be specific in your feature descriptions
- Use capable AI models for best results
- Iterate and guide the AI as needed

## Attribution

Based on [snarktank/ai-dev-tasks](https://github.com/snarktank/ai-dev-tasks)
