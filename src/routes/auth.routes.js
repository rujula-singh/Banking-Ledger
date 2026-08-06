import express from 'express';
import * as authController from '../controllers/auth.controller.js'

const router = express.Router();

/** 
 * POST /api/auth/register 
 */

router.use((req,res,next)=> {
  console.log(`Incoming Request: ${req.method} ${req.url}`);
  next();
})
router.post("/register",authController.userRegisterController);

/**
 * POST /api/auth/login
 */
router.post("/login",authController.userLoginController);

/**
 * - POST /api/auth/logout
 */
router.post("/logout",authController.userLogoutContoller);
export default router;