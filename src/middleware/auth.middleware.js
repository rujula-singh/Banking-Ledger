import userModel from '../models/user.model.js';
import jwt from 'jsonwebtoken';
import config from '../config/config.js';
import tokenBlackListModel from '../models/blackList.model.js';

export async function authMiddleware(req,res,next) {

  const token = req.cookies.token || req.headers.authorization?.split(" ")[1];

  if(!token) {
    return res.status(401).json({
      message:"Unauthorized access,token is missing"
    })
  }

  const isBlackListed = await tokenBlackListModel.findOne({token});

  if(isBlackListed) {
    return res.status(401).json({
      message:"Unauthorized access, token is invalid "
    })
  }

  try {
    const decoded = jwt.verify(token,config.JWT_SECRET)

    const user = await userModel.findById(decoded.userId);
    req.user = user
    return next();
  }
  catch(err) {
    return res.status(401).json({
      message:"Unauthorized access, token is invalid"
    })
  }
}

export async function authSystemUserMiddleware(req,res,next) {
  const token = req.cookies.token || req.headers.authorization?.split(" ")[1];

  if(!token) {
    return res.status(401).json({
      message:"Unauthorized access, token is missing"
    })
  }

  const isBlackListed = await tokenBlackListModel.findOne({token});

  if(isBlackListed) {
    return res.status(401).json({
      message:"Unauthorized access, token is invalid "
    })
  }

  try {
    const decoded = jwt.verify(token,config.JWT_SECRET);

    console.log(decoded)
    const user = await userModel.findById(decoded.userId).select("+systemUser");

    console.log(user.systemUser);
    if(!user.systemUser) {
      return res.status(403).json({
        message:"Forbidden accesss, not a system user"
      })
    }

    req.user = user;

    return next()
  }
  catch(err) {
    return res.status(401).json({
      message:"Unauthorized access, token is invalid"
    })
  }
}



