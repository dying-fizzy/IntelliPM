/**
 * INTELLIPM PRESENTATION CODE FLOW (BACKEND):
 * 1. Express server acting as an API gateway and custom proxy.
 * 2. Connects to Supabase for authentication and database interactions.
 * 3. Handles custom AI generation logic via the `/api/ai/generate-tasks` endpoint.
 * 4. Integtrates Google GenAI (Gemini) by calling `generateTasks` from `./aiProvider.js`.
 * 5. Serves static production assets from Vite's `dist` folder on fallback.
 * 6. Ensures security via JWT checks (`authenticate` middleware) and Role-Level Security in Supabase.
 */
import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';
import Groq from 'groq-sdk';
import { generateTasks } from './aiProvider.js';

// 1. Initial Config
dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE;
const SECRET_KEY = process.env.SECRET_KEY || 'intellipm_secret_key_123';
const PORT = process.env.PORT || 5000;

// Anon client for regular queries
const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');
// Admin client with service role — bypasses RLS, never expose to frontend
const supabaseAdmin = createClient(supabaseUrl || '', supabaseServiceKey || '', {
  auth: { autoRefreshToken: false, persistSession: false }
});

const app = express();

app.use((req, res, next) => {
  console.log(`>>> [SERVER] ${req.method} ${req.url}`);
  next();
});

// 3. App Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'No access token provided' });
  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    req.userId = decoded.id;
    next();
  } catch (err) {
    res.status(401).json({ message: 'Invalid or expired session' });
  }
};

// Internal service middleware — for frontend-to-backend calls (avoids Supabase JWT complexity)
const authenticateInternal = (req, res, next) => {
  const key = req.headers['x-internal-key'];
  if (!key || key !== SECRET_KEY) return res.status(401).json({ message: 'Unauthorized' });
  next();
};

// 4. API Routes
app.get('/ping', (req, res) => res.send('pong'));

// ── AI: Generate tasks for a project ──────────────────────────────────────
// Provider is controlled by AI_PROVIDER in .env (stub | gemini | custom)
const AI_TIMEOUT_MS = 300_000; // 5 minutes for very slow CPU inference

app.post('/api/ai/generate-tasks', async (req, res) => {
  const { projectId, description, projectType, complexity, mode } = req.body;

  if (!description || description.trim().length < 10) {
    return res.status(400).json({
      message: 'Project description is too short. Please provide more detail.',
      error_type: 'validation',
    });
  }

  // Race the AI call against a server-side timeout
  const timeoutHandle = setTimeout(() => {
    if (!res.headersSent) {
      console.error('>>> AI GENERATE TASKS: timed out server-side');
      res.status(503).json({
        message: 'AI unavailable — request timed out. Please assign manually or try again.',
        error_type: 'timeout',
      });
    }
  }, AI_TIMEOUT_MS);

  try {
    // 1. Fetch project members if projectId is provided
    let teamMembers = [];
    if (projectId) {
      const { data: members, error: memberErr } = await supabaseAdmin
        .from('project_members')
        .select('profiles(id, display_name, role)')
        .eq('project_id', projectId);

      if (!memberErr && members) {
        teamMembers = members
          .filter(m => m.profiles)
          .map(m => ({
            id: m.profiles.id,
            name: m.profiles.display_name,
            role: m.profiles.role,
            skills: []
          }));
      }
    }

    // 2. Call AI to generate tasks with member context
    console.log(`>>> AI GENERATE TASKS: Project="${projectId}", DescLength=${description.length}, Members=${teamMembers.length}`);
    const rawTasks = await generateTasks({ description, projectType, complexity, mode, teamMembers });
    clearTimeout(timeoutHandle);

    // Guard: empty result is a soft failure
    if (!rawTasks || rawTasks.length === 0) {
      return res.status(200).json({
        tasks: [],
        warning: 'AI returned no tasks. Try a more detailed description or assign manually.',
        error_type: 'empty',
      });
    }

    // 3. Map assignee names back to UUIDs
    // Strategy: try fuzzy name match first; if no match but team exists, round-robin assign
    const tasks = rawTasks.map((task, idx) => {
      const aiName = (task.assignee || '').toLowerCase().trim();

      // Tier 1: try exact / fuzzy name match
      const matchedMember = teamMembers.find(m => {
        const memberName = m.name.toLowerCase().trim();
        return memberName === aiName ||
               memberName.includes(aiName) ||
               aiName.includes(memberName) ||
               // also match first name only (e.g. AI says "John", member is "John Smith")
               memberName.split(' ')[0] === aiName.split(' ')[0];
      });

      if (matchedMember) {
        return {
          ...task,
          assigned_to: matchedMember.id,
          assignee_name: matchedMember.name
        };
      }

      // Tier 2: if we have team members but the AI hallucinated a wrong name,
      // round-robin assign so no task is ever left unassigned
      if (teamMembers.length > 0) {
        const fallback = teamMembers[idx % teamMembers.length];
        return {
          ...task,
          assigned_to: fallback.id,
          assignee_name: fallback.name
        };
      }

      // Tier 3: genuinely no team members on this project
      return {
        ...task,
        assigned_to: null,
        assignee_name: 'Unassigned'
      };
    });

    res.json({ tasks, provider: process.env.AI_PROVIDER || 'stub' });

  } catch (err) {
    clearTimeout(timeoutHandle);

    if (res.headersSent) return; // timeout already responded

    console.error('>>> AI GENERATE TASKS ERROR:', err.message);

    // Classify the error for the frontend
    const isTimeout = /timed out/i.test(err.message);
    const isKey     = /api.?key/i.test(err.message);

    res.status(503).json({
      message: isTimeout
        ? 'AI unavailable — request timed out. Please assign manually or try again.'
        : isKey
          ? 'AI unavailable — API key not configured. Please assign manually.'
          : 'AI unavailable — please assign manually or try again.',
      detail: err.message,
      error_type: isTimeout ? 'timeout' : isKey ? 'config' : 'error',
    });
  }
});

app.get('/api/projects/:id/tasks', async (req, res) => {
  res.json([
    { id: 1, ipm_id: 'IPM-101', title: 'Refactor Auth Kernel', status: 'In Progress', priority: 'Critical', complexity_score: 9, deadline: '2024-12-01', owner_name: 'S.Wozniak', ai_match: 98, timeLeft: '2h' },
    { id: 2, ipm_id: 'IPM-102', title: 'Neural Model Training', status: 'To Do', priority: 'High', complexity_score: 7, deadline: '2024-12-05', owner_name: 'A.Lovelace', ai_match: 92, timeLeft: '4d' }
  ]);
});

app.get('/api/projects/:id/ml-risk', async (req, res) => {
  try {
     const projectId = req.params.id;
     
     // Use the user's token to query Supabase so RLS lets us see the project!
     const token = req.headers.authorization?.split(' ')[1];
     const dbClient = token 
       ? createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: `Bearer ${token}` } } })
       : supabase;

     // 1. Fetch project details
     const { data: project, error: projErr } = await dbClient.from('projects').select('*').eq('id', projectId).single();
     
     // Fallback if project is not found so the ML UI works during testing
     const actualProject = project || {
       name: "Local Testing Project",
       description: "AI project with tight deadline and 5 developers",
       budget: 100000,
       start_date: new Date().toISOString(),
       end_date: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString()
     };

     // 2. Fetch team size
     const { count: teamSize } = await dbClient.from('project_members').select('*', { count: 'exact', head: true }).eq('project_id', projectId);

     // 3. Prep data for ML
     const proposalText = actualProject.description || actualProject.name || "No description provided.";
     
     let timelineDays = 180;
     if (actualProject.start_date && actualProject.end_date) {
        timelineDays = Math.max(1, Math.floor((new Date(actualProject.end_date) - new Date(actualProject.start_date)) / (1000 * 60 * 60 * 24)));
     }

     const mlPayload = {
        proposal_text: proposalText,
        budget: actualProject.budget || 100000,
        timeline_days: timelineDays,
        team_size: teamSize || 5
     };

     // 4. Call Python ML Microservice
     const mlApiUrl = process.env.ML_API_URL || 'http://127.0.0.1:8000';
    const mlResp = await fetch(`${mlApiUrl}/api/analyze-proposal`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify(mlPayload)
     });

     if (!mlResp.ok) {
        throw new Error(`ML Service Error: ${mlResp.statusText}`);
     }

     const mlData = await mlResp.json();
     res.json(mlData);

  } catch (error) {
     console.error('>>> ML PROXY ERROR:', error.message);
     res.status(500).json({ message: 'Failed to fetch AI insights', error: error.message });
  }
});

app.get('/api/dashboard/member', async (req, res) => {
  res.json({
    focusZone: [],
    aiFeed: [],
    velocity: [45, 52, 48, 65, 72, 68, 75, 82, 78, 85, 90, 88]
  });
});

app.post('/api/user/settings', authenticate, async (req, res) => {
  try {
    const { displayName, jobTitle, bio, skills, aiSensitivity, avatarUrl } = req.body;
    const { data, error } = await supabase.from('profiles').update({
        name: displayName,
        role: jobTitle,
        bio,
        skills,
        ai_sensitivity: aiSensitivity,
        avatar_url: avatarUrl
      }).eq('id', req.userId).select().single();
    if (error) throw error;
    res.json({ message: 'Profile updated', user: data });
  } catch (error) {
    res.status(500).json({ message: 'Failed to save settings' });
  }
});

app.get('/api/user/me', authenticate, async (req, res) => {
  try {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', req.userId).single();
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: 'Fetch failed' });
  }
});

app.get('/api/analytics/velocity', authenticate, async (req, res) => {
  try {
    const { data, error } = await supabase.rpc('get_velocity_analytics');
    if (error) throw error;
    const stats = data && data.length ? data[0] : { total_planned: 150, total_actual: 120 };
    res.json({ totalPlanned: stats.total_planned, totalActual: stats.total_actual });
  } catch (error) {
    res.status(500).json({ message: 'Analytics error' });
  }
});

app.get('/api/team/load', authenticate, async (req, res) => {
  try {
    const { data: profiles, error } = await supabase.from('profiles').select('id, name, role, avatar_url');
    if (error) throw error;
    const teamLoad = await Promise.all(profiles.map(async (u) => {
      const { data: tasks } = await supabase.from('tasks').select('*').eq('assigned_to', u.id).neq('status', 'Done');
      return { id: u.id, name: u.name, role: u.role, avatar: u.avatar_url || 'bg-blue-500', availableHours: 40, tasks: tasks || [] };
    }));
    res.json(teamLoad);
  } catch (error) {
    res.status(500).json({ message: 'Load calc failed' });
  }
});

app.patch('/api/tasks/:id/reassign', authenticate, async (req, res) => {
  try {
    const { newOwnerName } = req.body;
    const { data: targetUser, error: userError } = await supabase.from('profiles').select('id').eq('name', newOwnerName).single();
    if (userError || !targetUser) return res.status(404).json({ message: 'Target user not found' });
    const { error: taskError } = await supabase.from('tasks').update({ assigned_to: targetUser.id }).eq('id', req.params.id);
    if (taskError) throw taskError;
    res.json({ message: 'Task reassigned successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Reassignment failed' });
  }
});

app.post('/api/signup', (req, res) => res.status(410).json({ message: 'Signup migrated to Supabase Auth' }));
app.post('/api/login', (req, res) => res.status(410).json({ message: 'Login migrated to Supabase Auth' }));

// ── Admin: Permanently delete a user account ──────────────────────────────
app.delete('/api/admin/users/:userId', authenticate, async (req, res) => {
  const requesterId = req.userId;
  const targetId = req.params.userId;

  try {
    // 1. Verify the requester is an Admin (server-side enforcement)
    const { data: requester, error: reqErr } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', requesterId)
      .single();

    if (reqErr || !requester) return res.status(403).json({ message: 'Could not verify permissions.' });
    if (requester.role !== 'Admin') return res.status(403).json({ message: 'Access denied. Admin role required.' });

    // 2. Prevent self-deletion
    if (requesterId === targetId) return res.status(400).json({ message: 'You cannot delete your own account.' });

    // 3. Prevent deleting last admin
    const { data: target } = await supabase.from('profiles').select('role, display_name').eq('id', targetId).single();
    if (target?.role === 'Admin') {
      const { count } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'Admin');
      if ((count || 0) <= 1) return res.status(400).json({ message: 'Cannot delete the last admin account.' });
    }

    // 4. Permanently delete from Supabase Auth (cascades to profiles via FK)
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(targetId);
    if (deleteError) throw deleteError;

    // 5. Log the action
    await supabase.from('activity_logs').insert({
      user_id: requesterId,
      action: 'Permanently deleted user',
      entity_type: 'user',
      entity_id: targetId,
      details: `User "${target?.display_name || targetId}" permanently deleted by admin`,
    });

    res.json({ message: 'User permanently deleted.' });
  } catch (err) {
    console.error('>>> DELETE USER ERROR:', err);
    res.status(500).json({ message: err.message || 'Failed to delete user.' });
  }
});

// ── AI Chatbot: IntelliPM Assistant ───────────────────────────────────────
const INTELLIPM_SYSTEM_PROMPT = `You are the IntelliPM AI Assistant. Be concise and helpful. Only answer questions about IntelliPM. For off-topic questions say: "I only help with IntelliPM questions."

INTELLIPM: AI-powered project management platform with projects, tasks, sprints, team management, AI task generation, smart assign, risk assessment, and resource intelligence.

ROLES: Admin (full control, one per org, user management), Project Manager (create/manage projects, AI features), Team Member (work on assigned tasks).

AUTH: Register at /register (4 steps: credentials→email verification→org name→role). Login at /login (select role tab first). Org name must match exactly across teammates.

PROJECTS: /projects page. PMs/Admins create via "+ New Project". Fields: name, description, status, dates, budget, priority.

WORKSPACE TABS: Board (Kanban: To Do/In Progress/Review/Done), List (table view), Calendar (by deadline), Members, Activity, Settings, Risks, Sprints.

TASKS: Fields: title, status, priority (Low/Med/High/Critical), deadline, assignee, estimated days. Click task to edit. Created manually or via AI.

AI FEATURES:
- AI Task Generation: describe project → AI creates 8-10 tasks with assignments
- Smart Assign (/smart-assign): recommends best team member by skill/availability
- Risk Assessment (/risk-assessment or project Risks tab): ML predicts risk level, delays, budget overrun
- Resource Intelligence (/resource-intelligence): skill matrix heatmap, workload distribution

SPRINTS: Inside project → Sprints tab. Create with dates, add tasks, track velocity.
ADMIN DASHBOARD: /projects/admin — user management, audit logs, stats.
SETTINGS: /projects/settings — name, bio, skills, avatar, theme.
NAVIGATION: After login → /projects. Sidebar: Overview, Projects, Settings, Admin. Theme toggle: top-right navbar.

HOW-TOs:
- Create project: /projects → "+ New Project" → fill form → Create
- Add member: project → Members tab → Add Member
- Generate AI tasks: open project → AI Tasks → describe → Generate
- Change role: not possible, create new account`;

app.post('/api/chat', async (req, res) => {
  const { message, history = [] } = req.body;

  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'Message is required.' });
  }

  try {
    const messages = [
      { role: 'system', content: INTELLIPM_SYSTEM_PROMPT },
      // Last 6 messages for context (saves tokens vs 10)
      ...history.slice(-6).map(msg => ({
        role: msg.role === 'ai' ? 'assistant' : 'user',
        content: msg.text
      })),
      { role: 'user', content: message.trim() }
    ];

    // Always use Groq for the Chatbot (24/7 availability)
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey || apiKey === 'paste_your_groq_key_here') {
      return res.status(503).json({
        reply: 'The AI assistant is not configured. Please set GROQ_API_KEY in the .env file.'
      });
    }

    const groq = new Groq({ apiKey });
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages,
      temperature: 0.5,
      max_tokens: 400,
    });

    const reply = completion.choices[0]?.message?.content || 'I could not generate a response. Please try again.';
    res.json({ reply });

  } catch (err) {
    console.error('>>> CHAT API ERROR:', err.message);
    res.status(503).json({
      reply: 'AI assistant is temporarily unavailable. Please try again in a moment.'
    });
  }
});


// ── Task Attachments (RLS Bypass Proxy) ──────────────────────────────────
app.post('/api/upload-attachment', authenticateInternal, async (req, res) => {
  try {
    const { taskId, fileName, fileData, contentType, userId } = req.body;
    
    if (!taskId || !fileName || !fileData) return res.status(400).json({ error: 'Missing required fields' });

    console.log(`>>> UPLOAD: taskId=${taskId}, file=${fileName}, userId=${userId}, dataLen=${fileData?.length}`);

    const buffer = Buffer.from(fileData, 'base64');
    const filePath = `${taskId}/${Date.now()}_${fileName}`;
    
    const { error: uploadError } = await supabaseAdmin.storage
      .from('task-attachments')
      .upload(filePath, buffer, { 
        contentType: contentType || 'application/octet-stream', 
        upsert: true 
      });
    
    console.log(`>>> STORAGE RESULT: err=${uploadError?.message || 'none'}`);
    if (uploadError) throw uploadError;
    
    const { data: urlData } = supabaseAdmin.storage
      .from('task-attachments')
      .getPublicUrl(filePath);
      
    const { error: insertError } = await supabaseAdmin
      .from('task_attachments')
      .insert({
        task_id: taskId,
        file_url: urlData.publicUrl,
        file_name: fileName,
        uploaded_by: userId,
      });
    
    console.log(`>>> DB INSERT RESULT: err=${insertError?.message || 'none'}`);
    if (insertError) throw insertError;

    console.log(`>>> UPLOAD SUCCESS: ${fileName}`);
    res.json({ success: true });
  } catch (error) {
    console.error('>>> UPLOAD ERROR:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/task-attachments/:taskId', authenticateInternal, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('task_attachments')
      .select('*, profiles:uploaded_by ( display_name )')
      .eq('task_id', req.params.taskId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    console.error('>>> FETCH ATTACHMENTS ERROR:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/attachments/:id', authenticateInternal, async (req, res) => {
  try {
    const attachmentId = req.params.id;
    const { data: att } = await supabaseAdmin.from('task_attachments').select('*').eq('id', attachmentId).single();
    if (!att) return res.status(404).json({ error: 'Not found' });
    
    const urlParts = att.file_url.split('/task-attachments/');
    const storagePath = urlParts.length > 1 ? urlParts[1] : null;
    if (storagePath) {
      await supabaseAdmin.storage.from('task-attachments').remove([storagePath]);
    }
    await supabaseAdmin.from('task_attachments').delete().eq('id', attachmentId);
    
    res.json({ success: true });
  } catch (err) {
    console.error('>>> DELETE ATTACHMENT ERROR:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// 5. Fallback & Errors
app.use(express.static(path.join(__dirname, 'dist')));


app.use((req, res) => {
  console.log(`>>> [FALLBACK] ${req.method} ${req.url} -> index.html`);
  res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
});

app.use((err, req, res, next) => {
  console.error('>>> SERVER ERROR:', err);
  res.status(err.status || 500).json({ message: err.message || 'Internal Server Error' });
});

// 6. Start
app.listen(PORT, () => {
    console.log(`>>> IntelliPM Unified Server running at http://localhost:${PORT}`);
});
