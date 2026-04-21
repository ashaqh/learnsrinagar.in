import { createCookieSessionStorage, redirect } from "@remix-run/node";
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from './db';

const JWT_SECRET = process.env.SESSION_SECRET

// FP-10: Crash loudly on startup if SESSION_SECRET is missing in production.
// A known fallback secret ("s3cret") is a critical security vulnerability.
if (!JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('FATAL: SESSION_SECRET environment variable is not set. Refusing to start in production.')
  }
  console.warn('[Auth] WARNING: SESSION_SECRET is not set. Using insecure default — for development only.')
}

const _JWT_SECRET = JWT_SECRET || 's3cret'

const sessionStorage = createCookieSessionStorage({
    cookie: {
        name: "__session",
        secrets: ["s3cret"],
        sameSite: "lax",
        path: "/",
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
    },
});

export const { commitSession, destroySession, getSession } = sessionStorage;

export async function createSession(request, user) {
    const session = await sessionStorage.getSession(request.headers.get("Cookie"));
    session.set('user', user);
    return redirect('/dashboard', {
        headers: {
            "Set-Cookie": await sessionStorage.commitSession(session, {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "lax",
                maxAge: 60 * 60 * 24 * 7
            }),
        },
    });
}

export async function deleteSession(request) {
    const session = await sessionStorage.getSession(request.headers.get("Cookie"));
    return redirect("/login", {
        headers: {
            "Set-Cookie": await sessionStorage.destroySession(session),
        },
    });
}

export async function getUser(request) {
    const session = await sessionStorage.getSession(request.headers.get("Cookie"));
    const user = session.get('user');
    return user;
}

export function generateToken(user) {
    return jwt.sign(user, _JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token) {
    try {
        return jwt.verify(token, _JWT_SECRET);
    } catch (e) {
        return null;
    }
}

export async function verifyLogin(email, password) {
    const users = await query('SELECT * FROM users WHERE email = ?', [email]);
    
    if (users.length === 0) {
        return null;
    }
    
    const user = users[0];
    let passwordHash = user.password_hash;
    
    // Fix bcrypt format if needed ($2b$ -> $2a$)
    if (passwordHash.startsWith('$2b$')) {
        passwordHash = passwordHash.replace('$2b$', '$2a$');
    }
    
    const isValid = await bcrypt.compare(password, passwordHash);
    
    if (!isValid) {
        return null;
    }
    
    return user;
}