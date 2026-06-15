import { GoogleGenAI } from '@google/genai';
import Groq from 'groq-sdk';
import dotenv from 'dotenv';
dotenv.config();

export async function generateTasks({ description, projectType, complexity, mode, teamMembers = [] }) {
  let provider = process.env.AI_PROVIDER || 'groq';
  console.log(`>>> AI PROVIDER SELECTED: "${provider}"`);

  if (provider === 'ollama') {
     console.log('>>> OLLAMA detected. Overriding to GROQ because local 1B/3B models cannot generate 20 high-quality tasks.');
     provider = 'groq';
  }

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
    const memberContext = teamMembers.length > 0
      ? `Available Team Members and their roles:\n${teamMembers.map(m => `- ${m.name} (${m.role}) ${m.skills && m.skills.length > 0 ? `— Skills: ${m.skills.join(', ')}` : ''}`).join('\n')}`
      : "No specific team members provided. Use generic role names like 'Developer', 'Designer', etc.";

    const prompt = `You are a senior project manager. You MUST generate EXACTLY 15 to 20 unique, realistic tasks for this project, ordered chronologically.

Project Description: ${description}
Project Type: ${projectType || 'Software Development'}
Complexity (1-10): ${complexity || 5}

${memberContext}

IMPORTANT: Return ONLY valid JSON — no markdown, no explanation, no code blocks.
Return this exact structure:
{"tasks": [{"title": "Task name here", "priority": "High", "assignee": "Team member name", "estimated_days": 3}]}

Rules:
1. Generate EXACTLY 15 to 20 tasks. If you only have a few main tasks, you MUST break them down into smaller micro-tasks (e.g. Planning, Setup, Implementation, Testing, Review for EACH feature) to reach at least 15 tasks.
2. Order the tasks chronologically (Phase 1 first, deployment last).
3. priority must be exactly: High, Medium, or Low.
4. assignee must be a real team member name exactly as spelled in the list above, or "Unassigned". Do not invent names.
5. estimated_days must be an integer between 1 and 14.
6. No duplicate tasks.
7. Tasks should be specific and actionable.`;

    // ── Groq (default) ────────────────────────────────────────────
    if (provider === 'groq') {
      const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
      console.log('>>> GROQ: Generating tasks via llama-3.3-70b-versatile...');

      const completion = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: 'You are a project management AI. You always respond with valid JSON only, no markdown, no explanation.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.6,
        max_tokens: 2048,
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

    // ── Ollama (Hugging Face Space) ────────────────────────────────
    if (provider === 'ollama') {
       // Code removed since we now override to groq at the top
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
