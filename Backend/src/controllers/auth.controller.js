import userModel from '../models/user.model.js';
import accountModel from '../models/account.model.js';
import notificationModel from '../models/notification.model.js';
import tokenBlackListModel from '../models/blackList.model.js';
import { withTransaction } from '../config/db.js';
import jwt from 'jsonwebtoken';
import config from '../config/config.js';
import * as emailService from '../services/email.service.js';

function parseUserAgent(ua = '') {
  let browser = 'Chrome';
  if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';
  else if (ua.includes('Edge')) browser = 'Edge';

  let device = 'Desktop (Windows)';
  if (ua.includes('iPhone') || ua.includes('iPad')) device = 'Mobile (iOS)';
  else if (ua.includes('Android')) device = 'Mobile (Android)';
  else if (ua.includes('Macintosh')) device = 'Desktop (macOS)';
  else if (ua.includes('Linux')) device = 'Desktop (Linux)';

  return { browser, device };
}

/**
 * Register user & auto-provision primary Savings account inside a PostgreSQL transaction
 */
export async function userRegisterController(req, res) {
  try {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({
        success: false,
        message: 'Name, email and password are required'
      });
    }

    const existingUser = await userModel.findByEmail(email);
    if (existingUser) {
      return res.status(422).json({
        success: false,
        message: 'A user with this email address already exists.'
      });
    }

    const { browser, device } = parseUserAgent(req.headers['user-agent']);
    const sessionId = `SES-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const randomSuffix = Math.floor(10000000 + Math.random() * 90000000).toString();
    const accountNumber = `4821${randomSuffix}`;

    const { user, primaryAccount } = await withTransaction(async (client) => {
      // 1. Create User
      const newUser = await userModel.createUser(
        { email, password, name, systemUser: false },
        client
      );

      // 2. Add Session
      await userModel.addSession(
        newUser.id,
        {
          sessionId,
          device,
          browser,
          location: 'Delhi, India',
          ip: req.ip || '127.0.0.1'
        },
        client
      );

      // 3. Create primary Savings account
      const newAccount = await accountModel.createAccount(
        {
          userId: newUser.id,
          accountType: 'SAVINGS',
          accountNumber,
          name: 'Primary Savings Account',
          currency: 'INR'
        },
        client
      );

      // 4. Create welcome notification
      await notificationModel.createNotification(
        {
          userId: newUser.id,
          title: 'Welcome to Personal Banking!',
          message: `Your account has been set up with primary Savings account •••• ${randomSuffix.slice(-4)}.`,
          type: 'SUCCESS'
        },
        client
      );

      return { user: newUser, primaryAccount: newAccount };
    });

    const token = jwt.sign(
      { userId: user.id, sessionId },
      config.JWT_SECRET,
      { expiresIn: '3d' }
    );

    res.cookie('token', token, { httpOnly: true, sameSite: 'lax' });

    // Non-blocking email delivery
    emailService.sendRegistrationEmail(user.email, user.name).catch(() => {});

    return res.status(201).json({
      success: true,
      user: {
        id: user.id,
        _id: user.id,
        email: user.email,
        name: user.name
      },
      primaryAccount: {
        id: primaryAccount.id,
        _id: primaryAccount.id,
        accountNumber: primaryAccount.accountNumber,
        accountType: primaryAccount.accountType,
        maskedNumber: `•••• ${primaryAccount.accountNumber.slice(-4)}`
      },
      sessionId,
      token
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * User Login Controller with session recording in PostgreSQL
 */
export async function userLoginController(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    const user = await userModel.findByEmail(email, true);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    const isValidPassword = await userModel.comparePassword(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    const { browser, device } = parseUserAgent(req.headers['user-agent']);
    const sessionId = `SES-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

    await userModel.addSession(user.id, {
      sessionId,
      device,
      browser,
      location: 'Delhi, India',
      ip: req.ip || '127.0.0.1'
    });

    const token = jwt.sign(
      { userId: user.id, sessionId },
      config.JWT_SECRET,
      { expiresIn: '3d' }
    );

    res.cookie('token', token, { httpOnly: true, sameSite: 'lax' });

    return res.status(200).json({
      success: true,
      user: {
        id: user.id,
        _id: user.id,
        email: user.email,
        name: user.name
      },
      sessionId,
      token
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * User Logout Controller
 */
export async function userLogoutContoller(req, res) {
  try {
    const token = req.cookies?.token || req.headers.authorization?.split(' ')[1];

    if (token) {
      await tokenBlackListModel.blacklistToken(token);
    }
    res.clearCookie('token', { path: '/' });

    return res.status(200).json({
      success: true,
      message: 'User logged out successfully'
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Internal server error during logout'
    });
  }
}

/**
 * Current User Profile
 */
export async function getUserProfile(req, res) {
  try {
    const user = await userModel.findById(req.user.id || req.user._id);
    return res.status(200).json({
      success: true,
      user
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * Get active sessions & security activity
 */
export async function getUserSessions(req, res) {
  try {
    const userId = req.user.id || req.user._id;
    const sessions = await userModel.getUserSessions(userId);

    return res.status(200).json({
      success: true,
      sessions
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * Revoke all other sessions
 */
export async function revokeOtherSessions(req, res) {
  try {
    const { currentSessionId } = req.body;
    const userId = req.user.id || req.user._id;

    await userModel.revokeOtherSessions(userId, currentSessionId);

    return res.status(200).json({
      success: true,
      message: 'All other sessions have been logged out.'
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}
