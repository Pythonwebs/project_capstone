import express, { json } from "express";
import { randomBytes, createHash } from "crypto";
import axios from "axios";
import cookieParser from "cookie-parser";
import { stringify } from "qs";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cookieParser());
app.use(json());
app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);

const REDIRECT_URI = process.env.REDIRECT_URI;
const SN_INTANCE = process.env.SN_INTANCE;
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const authEndpoint = `${SN_INTANCE}/oauth_auth.do`;
const tokenEndpoint = `${SN_INTANCE}/oauth_token.do`;

// in real-life we would use Redis here
const tokenStore = new Map();

function base64url(buf) {
  return buf
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

app.get("/auth/login", (req, res) => {
  const verifier = base64url(randomBytes(32));
  const challenge = base64url(createHash("sha256").update(verifier).digest());
  const state = base64url(randomBytes(16));
  const sessionId = base64url(randomBytes(24));

  tokenStore.set(sessionId, {
    code_verifier: verifier,
    state: state,
    expiresAt: Date.now() + 15 * 60 * 1000,
  });

  res.cookie("sid", sessionId, {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    path: "/",
    maxAge: Date.now() + 15 * 60 * 1000,
  });

  const params = new URLSearchParams({
    response_type: "code",
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    code_challenge: challenge,
    code_challenge_method: "S256",
    state: state,
  });

  res.redirect(`${authEndpoint}?${params.toString()}`);
});

app.get("/auth/callback", async (req, res) => {
  const { code, state } = req.query;
  const sid = req.cookies.sid;
  const session = tokenStore.get(sid);

  if (!session) return res.status(400).send("Bad session");
  if (session.state !== state) return res.status(400).send("State Mismatch");

  const data = {
    grant_type: "authorization_code",
    code: code,
    redirect_uri: REDIRECT_URI,
    client_id: CLIENT_ID,
    code_verifier: session.code_verifier,
    client_secret: CLIENT_SECRET,
  };

  const resp = await axios.post(tokenEndpoint, stringify(data), {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });

  tokenStore.set(sid, { ...session, ...resp.data, obtained_at: Date.now() });
  res.redirect("http://localhost:5173/");
});

app.get("/auth/status", (req, res) => {
  const sid = req.cookies.sid;
  const session = tokenStore.get(sid);
  if (!session || !session.access_token)
    return res.json({ authenticated: false });
  return res.json({ authenticated: true });
});

app.get("/auth/logout", (req, res) => {
  const sid = req.cookies.sid;
  if (sid) {
    tokenStore.delete(sid);
    res.clearCookie("sid", { path: "/" });
  }
  res.json({ ok: true });
});

// Create incident endpoint
app.post("/api/incidents", async (req, res) => {
  const sid = req.cookies.sid;
  const session = tokenStore.get(sid);

  if (!session || !session.access_token) return res.status(401).json({ error: 'Not authenticated' });

  const payload = {
    short_description: req.body.short_description,
    impact: req.body.impact,
    urgency: req.body.urgency,
    category: req.body.category,
    subcategory: req.body.subcategory,
    assignment_group: req.body.assignment_group,
  };

  // helper to call ServiceNow create
  const callCreate = async (accessToken) => {
    return axios({
      method: 'post',
      url: `${SN_INTANCE}/api/now/table/incident`,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      data: payload,
    });
  };

  try {
    // First attempt
    const response = await callCreate(session.access_token);
    return res.json(response.data);
  } catch (error) {
    // If token expired, try refresh and retry
    if (error.response?.status === 401 && session.refresh_token) {
      try {
        const data = {
          grant_type: 'refresh_token',
          refresh_token: session.refresh_token,
          client_id: CLIENT_ID,
        };

        const refresh = await axios.post(tokenEndpoint, stringify(data), {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        });

        // store new tokens
        tokenStore.set(sid, { ...session, ...refresh.data });
        const newSession = tokenStore.get(sid);

        // retry create with new access token
        const retry = await callCreate(newSession.access_token);
        return res.json(retry.data);
      } catch (refreshErr) {
        console.error('Token refresh/create retry failed:', refreshErr.response?.data || refreshErr.message);
        return res.status(401).json({ error: 'Session expired, please re-authenticate', details: refreshErr.response?.data });
      }
    }

    console.error('Error creating incident:', error.response?.data || error.message);
    return res.status(error.response?.status || 500).json({ error: error.response?.data || 'Failed to create incident' });
  }
});



// Delete incident endpoint
app.delete("/api/incidents/:sys_id", async (req, res) => {
  const sid = req.cookies.sid;
  const session = tokenStore.get(sid);

  if (!session.access_token) return res.status(401).send("Not authenticated");

  try {
    await axios({
      method: 'delete',
      url: `${SN_INTANCE}/api/now/table/incident/${req.params.sys_id}`,
      headers: { 
        'Authorization': `Bearer ${session.access_token}`,
        'Accept': 'application/json'
      }
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting incident:', error.response?.data || error);
    res.status(error.response?.status || 500).json({
      error: error.response?.data?.error?.message || "Error deleting incident"
    });
  }
});

// Update incident endpoint
app.put("/api/incidents/:sys_id", async (req, res) => {
  const sid = req.cookies.sid;
  const session = tokenStore.get(sid);

  if (!session.access_token) return res.status(401).send("Not authenticated");

  try {
    console.log('Updating incident:', req.params.sys_id, req.body);
    const response = await axios({
      method: 'patch', // ServiceNow prefers PATCH for updates
      url: `${SN_INTANCE}/api/now/table/incident/${req.params.sys_id}`,
      headers: { 
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      data: req.body
    });
    console.log('Update response:', response.data);
    res.json(response.data);
  } catch (error) {
    console.error('Error updating incident:', error.response?.data || error);
    res.status(error.response?.status || 500).json({
      error: error.response?.data?.error?.message || "Error updating incident"
    });
  }
});

app.get("/api/incidents", async (req, res) => {
  const sid = req.cookies.sid;
  const session = tokenStore.get(sid);

  if (!session.access_token) return res.status(401).send("Not authenticated");

  try {
    const r = await axios.get(
      `${SN_INTANCE}/api/now/table/incident?sysparm_display_value=true&sysparm_fields=sys_id%2Cnumber%2Cstate%2Cpriority%2Cshort_description`,
      {
        headers: { Authorization: `Bearer ${session.access_token}` },
      }
    );
    res.json(r.data);
  } catch (e) {
    if (e.response.status == 401 && session.refresh_token) {
      const data = {
        grant_type: "refresh_token",
        refresh_token: session.refresh_token,
        client_id: CLIENT_ID,
      };

      try {
        const refresh = await axios.post(tokenEndpoint, stringify(data), {
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
        });

        tokenStore.set(sid, { ...session, ...refresh.data });

        const retry = await axios.get(
          `${SN_INTANCE}/api/now/table/incident?sysparm_display_value=true&sysparm_fields=number%2Cstate%2Cpriority%2Cshort_description`,
          {
            headers: { Authorization: `Bearer ${session.access_token}` },
          }
        );
        res.json(r.data);
      } catch (e) {
        res.status(401).send("Session Expired");
      }
      res.status(e.response.status || 500).send("Upstream error");
    }
  }
});

app.listen(3001, () => console.log("BFF on 3001"));
