import { GoogleGenAI } from '@google/genai';
import Groq from 'groq-sdk';
import dotenv from 'dotenv';
dotenv.config();

export async function generateTasks({ description, projectType, complexity, mode, teamMembers = [] }) {
  const provider = process.env.AI_PROVIDER || 'groq';
  console.log(`>>> AI PROVIDER SELECTED: "${provider}"`);

  if (provider === 'stub') {
    // Return mock tasks as a stub
    return [
      { title: 'Project Kickoff & Scope Definition', priority: 'High', status: 'To Do', assignee: teamMembers[0]?.name || 'Unassigned', estimated_days: 2 },
      { title: `Initialize ${projectType || 'Project'} Structure`, priority: 'High', status: 'To Do', assignee: teamMembers[1]?.name || teamMembers[0]?.name || 'Unassigned', estimated_days: 3 },
      { title: 'Database Schema Design', priority: 'Medium', status: 'To Do', assignee: teamMembers[2]?.name || teamMembers[0]?.name || 'Unassigned', estimated_days: 4 },
      { title: 'Setup Authentication & Authorization', priority: 'High', status: 'To Do', assignee: teamMembers[0]?.name || 'Unassigned', estimated_days: 3 },
      { title: 'API Endpoint Implementation', priority: 'Medium', status: 'To Do', assignee: teamMembers[1]?.name || 'Unassigned', estimated_days: 5 },
      { title: 'Frontend Component Development', priority: 'Medium', status: 'To Do', assignee: teamMembers[2]?.name || 'Unassigned', estimated_days: 7 },
      { title: 'QA & Unit Testing', priority: 'Medium', status: 'To Do', assignee: teamMembers[0]?.name || 'Unassigned', estimated_days: 3 },
      { title: 'Final Deployment & Review', priority: 'High', status: 'To Do', assignee: teamMembers[1]?.name || 'Unassigned', estimated_days: 1 }
    ];
  }

  else if (provider === 'groq' || provider === 'gemini' || provider === 'ollama') {
    const memberNames = teamMembers.length > 0
      ? teamMembers.map(m => m.name).join(', ')
      : null;

    const memberContext = teamMembers.length > 0
      ? `TEAM MEMBERS (you MUST assign every task to one of these exact names):\n${teamMembers.map((m, i) => `${i + 1}. ${m.name} — ${m.role}${m.skills && m.skills.length > 0 ? ` (${m.skills.join(', ')})` : ''}`).join('\n')}`
      : "No team members provided. Use 'Unassigned' for all tasks.";

    const prompt = `You are a senior project manager. You MUST generate EXACTLY 15 to 20 unique, realistic tasks for this project, ordered chronologically.

Project Description: ${description}
Project Type: ${projectType || 'Software Development'}
Complexity (1-10): ${complexity || 5}

${memberContext}

IMPORTANT: Return ONLY valid JSON — no markdown, no explanation, no code blocks.
Return this exact structure:
{"tasks": [{"title": "Task name here", "priority": "High", "assignee": "Team member name", "estimated_days": 3}]}

Rules:
1. Generate EXACTLY 15 to 20 tasks. If you only have a few main tasks, break them into smaller micro-tasks to reach at least 15.
2. Order tasks chronologically (planning first, deployment last).
3. priority must be exactly one of: High, Medium, or Low.
4. assignee MUST be one of these exact names: ${memberNames || 'Unassigned'}. Do NOT invent names. Do NOT use generic names like "Developer" or "Designer".
5. Distribute tasks evenly across all team members. Every member should get at least one task.
6. estimated_days must be an integer between 1 and 14.
7. No duplicate tasks.
8. Tasks must be specific and actionable.`;

    // ── Groq (default) ────────────────────────────────────────────
    if (provider === 'groq') {
      const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
      // llama-3.1-8b-instant is Groq's fastest model — purpose-built for low latency
      console.log('>>> GROQ: Generating tasks via llama-3.1-8b-instant...');

      const completion = await groq.chat.completions.create({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: 'You are a project management AI. You always respond with valid JSON only, no markdown, no explanation.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.4,
        max_tokens: 1400,
      });

      const text = completion.choices[0]?.message?.content || '';
      console.log('>>> GROQ RAW RESPONSE:', text.substring(0, 300));

      // Robust JSON extraction
      const firstBrace = text.indexOf('{');
      const lastBrace  = text.lastIndexOf('}');
      if (firstBrace === -1 || lastBrace === -1) throw new Error('No JSON found in Groq response');

      const jsonStr = text.substring(firstBrace, lastBrace + 1);
      const parsed  = JSON.parse(jsonStr);
      let tasks = parsed.tasks || parsed;
      if (!Array.isArray(tasks)) tasks = [tasks];

      return tasks.map(t => ({
        title:          t.title       || t.name      || 'Untitled Task',
        priority:       t.priority    || 'Medium',
        status:         t.status      || 'To Do',
        assignee:       t.assignee    || t.assigned_to || 'Unassigned',
        estimated_days: parseInt(t.estimated_days) || 3,
      }));
    }

    // ── Ollama (Hugging Face Space or Local) ────────────────────────────────
    if (provider === 'ollama') {
      console.log('>>> OLLAMA: Generating tasks sequentially via multi-phase prompting...');
      const ollamaHost = process.env.OLLAMA_HOST || 'http://localhost:11434';
      
      const phases = [
        "Phase 1: Planning, Research, and Initial Setup",
        "Phase 2: Core Development and Implementation",
        "Phase 3: QA Testing, Final Review, and Deployment"
      ];
      
      let allTasks = [];
      
      // Process sequentially to prevent queueing/timeouts on local Ollama
      for (const phase of phases) {
        console.log(`>>> OLLAMA: Starting ${phase}...`);
        const phasePrompt = `You are a senior project manager. Generate EXACTLY 5 to 7 unique, realistic tasks specifically for ${phase} of this project.

Project Description: ${description}
Project Type: ${projectType || 'Software Development'}
Complexity (1-10): ${complexity || 5}

${memberContext}

IMPORTANT: Return ONLY valid JSON — no markdown, no explanation, no code blocks.
Return this exact structure:
{"tasks": [{"title": "Task name here", "priority": "High", "assignee": "Team member name", "estimated_days": 3}]}

Rules:
1. Generate EXACTLY 5 to 7 tasks for ${phase}.
2. priority must be exactly one of: High, Medium, or Low.
3. assignee MUST be one of these exact names: ${memberNames || 'Unassigned'}. Do NOT invent names.
4. estimated_days must be an integer between 1 and 14.`;

        try {
          const response = await fetch(`${ollamaHost}/api/chat`, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'ngrok-skip-browser-warning': 'true'
            },
            body: JSON.stringify({
              model: process.env.OLLAMA_MODEL || 'llama3-tasks:latest',
              messages: [{ role: 'system', content: 'Return ONLY valid JSON.' }, { role: 'user', content: phasePrompt }],
              format: 'json',
              stream: false,
              options: { temperature: 0.7, num_predict: 2048 }
            })
          });
          
          if (response.ok) {
            const data = await response.json();
            const text = data.message?.content || '';
            const firstBrace = text.indexOf('{');
            const lastBrace  = text.lastIndexOf('}');
            if (firstBrace !== -1 && lastBrace !== -1) {
              const jsonStr = text.substring(firstBrace, lastBrace + 1);
              const parsed  = JSON.parse(jsonStr);
              let tasks = parsed.tasks || parsed;
              if (!Array.isArray(tasks)) tasks = [tasks];
              allTasks.push(...tasks);
            }
          } else {
             console.error('Ollama response not OK:', response.statusText);
          }
        } catch (e) {
          console.error(`Ollama Phase error for ${phase}:`, e.message);
        }
      }

      if (allTasks.length === 0) throw new Error('No JSON found in Ollama response');

      return allTasks.map(t => ({
        title:          t.title       || t.name      || 'Untitled Task',
        priority:       t.priority    || 'Medium',
        status:         t.status      || 'To Do',
        assignee:       t.assignee    || t.assigned_to || 'Unassigned',
        estimated_days: parseInt(t.estimated_days) || 3,
      }));
    }

    // ── Gemini fallback ────────────────────────────────────────────
    if (provider === 'gemini') {
      const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const result = await genAI.models.generateContent({
        model: 'gemini-1.5-flash',
        contents: prompt,
      });
      const text = result.text || '';
      const firstBrace = text.indexOf('{');
      const lastBrace  = text.lastIndexOf('}');
      if (firstBrace === -1) return [];
      const parsed = JSON.parse(text.substring(firstBrace, lastBrace + 1));
      let tasks = parsed.tasks || parsed;
      if (!Array.isArray(tasks)) tasks = [tasks];
      return tasks.map(t => ({
        title:          t.title    || 'Untitled Task',
        priority:       t.priority || 'Medium',
        status:         'To Do',
        assignee:       t.assignee || 'Unassigned',
        estimated_days: parseInt(t.estimated_days) || 3,
      }));
    }
  }

  return [];
}
