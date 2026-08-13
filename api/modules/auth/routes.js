import express from 'express';
import loginRouter from '../../handlers/login.js';
import registerRouter from '../../handlers/register.js';
import resetPasswordRouter from '../../handlers/reset-password.js';
import guestLoginRouter from '../../handlers/guest-login.js';
import { getUserProvince, setUserProvince, deleteUserProvince } from '../../handlers/user-province.js';

const router = express.Router();

router.post('/login', loginRouter);
router.post('/register', registerRouter);
router.use('/reset-password', resetPasswordRouter);
router.use('/guest', guestLoginRouter);
router.get('/prefs/province', getUserProvince);
router.post('/prefs/province', setUserProvince);
router.delete('/prefs/province', deleteUserProvince);

export default router;
