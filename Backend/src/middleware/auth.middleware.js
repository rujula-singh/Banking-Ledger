import userModel from '../models/user.model.js';
import jwt from 'jsonwebtoken';
import config from '../config/config.js';
import tokenBlackListModel from '../models/blackList.model.js';

export async function authMiddleware(req, res, next) {
  const token = req.cookies?.token || req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized access, token is missing'
    });
  }

  const isBlackListed = await tokenBlackListModel.isTokenBlacklisted(token);

  if (isBlackListed) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized access, token is invalid'
    });
  }

  try {
    const decoded = jwt.verify(token, config.JWT_SECRET);
    const user = await userModel.findById(decoded.userId);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized access, user not found'
      });
    }

    req.user = user;
    return next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized access, token is invalid'
    });
  }
}

export async function authSystemUserMiddleware(req, res, next) {
  const token = req.cookies?.token || req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized access, token is missing'
    });
  }

  const isBlackListed = await tokenBlackListModel.isTokenBlacklisted(token);

  if (isBlackListed) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized access, token is invalid'
    });
  }

  try {
    const decoded = jwt.verify(token, config.JWT_SECRET);
    const user = await userModel.findById(decoded.userId, true);

    if (!user || !user.systemUser) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden access, not a system user'
      });
    }

    req.user = user;
    return next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized access, token is invalid'
    });
  }
}
