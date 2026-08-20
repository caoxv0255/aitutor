import express from 'express';
import loginRouter from '../../handlers/login.js';
import registerRouter from '../../handlers/register.js';
import resetPasswordRouter from '../../handlers/reset-password.js';
import guestLoginRouter from '../../handlers/guest-login.js';
import { getUserProvince, setUserProvince, deleteUserProvince } from '../../handlers/user-province.js';
import { authMiddleware } from '../../core/auth.js';
import { successResponse } from '../../utils/response.js';

const router = express.Router();

router.post('/login', loginRouter);
router.post('/register', registerRouter);

router.use('/guest', guestLoginRouter);
router.use('/guest-login', guestLoginRouter); // 别名: F3 service 调 /api/auth/guest-login (P0.6 对齐)
// P0.7: 补齐 F3 auth service 契约
router.get('/me', authMiddleware, (req, res) => {
  res.json(
    successResponse(
      { email: req.user.email, grade: req.user.grade || null, name: req.user.name || null },
      '获取当前用户成功'
    )
  );
});
router.post('/logout', (req, res) => {
  // JWT 无状态, 前端负责清除本地 token; 端点仅保证 200 (F3 service 契约)
  res.json(successResponse(null, '退出成功'));
});
router.get('/prefs/province', getUserProvince);
router.post('/prefs/province', setUserProvince);
router.delete('/prefs/province', deleteUserProvince);

export default router;
