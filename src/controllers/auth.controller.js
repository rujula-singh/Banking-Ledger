import userModel from '../models/user.model.js';
import jwt from 'jsonwebtoken';
import config from '../config/config.js';
import * as emailService from '../services/email.service.js';
import tokenBlackListModel from '../models/blackList.model.js';

/**
 * - user register controller
 * - POST /api/auth/register
 */

export async function userRegisterController(req, res) {
    const { email, password, name } = req.body

    const isExists = await userModel.findOne({
        email: email
    })

    if (isExists) {
        return res.status(422).json({
            message: "User already exists with email.",
            status: "failed"
        })
    }

    const user = await userModel.create({
        email, password, name
    })

    const token = jwt.sign({ userId: user._id }, config.JWT_SECRET, { expiresIn: "3d" })

    res.cookie("token", token)

    res.status(201).json({
        user: {
            _id: user._id,
            email: user.email,
            name: user.name
        },
        token
    })

    await emailService.sendRegistrationEmail(user.email, user.name)
}

/**
 * - User Login Controller
 * - POST /api/auth/login
 */

export async function userLoginController(req, res) {
    const { email, password } = req.body

    const user = await userModel.findOne({ email }).select("+password")

    if (!user) {
        return res.status(401).json({
            message: "Email or password is INVALID"
        })
    }

    const isValidPassword = await user.comparePassword(password)

    if (!isValidPassword) {
        return res.status(401).json({
            message: "Email or password is INVALID"
        })
    }

    const token = jwt.sign({ userId: user._id }, config.JWT_SECRET, { expiresIn: "3d" })

    res.cookie("token", token)

    res.status(200).json({
        user: {
            _id: user._id,
            email: user.email,
            name: user.name
        },
        token
    })

}

/**
 * - User Logout Controller
 * - POST /api/auth/logout
 */

export async function userLogoutContoller(req,res) {
    try {
    const token = req.cookies.token || req.headers.authorization?.split(" ")[1];
     
    if(token){
    await tokenBlackListModel.create({
        token:token
    })
    }
    res.clearCookie("token",{path:"/"});

    return res.status(200).json({
        message:"User logged out successfully"
    })
} catch(error) {
    return res.status(500).json({
        message:"Internal server error during logout"
    })
}
}






