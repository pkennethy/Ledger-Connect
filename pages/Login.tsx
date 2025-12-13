import React, { useState, useEffect } from 'react';
import { Lock, ArrowRight, Shield, RefreshCw, AlertTriangle, UserX, Info } from 'lucide-react';
import { MockService } from '../services/mockData';
import { User, DICTIONARY, Language, UserRole } from '../types';
import { useToast } from '../context/ToastContext';
import { AdBanner } from '../components/AdBanner';
import { CONFIG } from '../config';

interface LoginProps {
    onLogin: (user: User) => void;
    lang: Language;
}

// Simple random captcha generator
const generateCaptcha = () => Math.floor(1000 + Math.random() * 9000).toString();

export const Login: React.FC<LoginProps> = ({ onLogin, lang }) => {
    const { showToast } = useToast();
    const t = DICTIONARY[lang];
    
    // UI State
    const [step, setStep] = useState<'PHONE' | 'AUTH'>('PHONE');
    const [loading, setLoading] = useState(false);
    
    // Inputs
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [captchaInput, setCaptchaInput] = useState('');
    const [captchaCode, setCaptchaCode] = useState(generateCaptcha());
    
    // Auth Context (Determined after Phone step)
    const [userExists, setUserExists] = useState(false);
    const [targetRole, setTargetRole] = useState<UserRole>(UserRole.CUSTOMER);
    
    useEffect(() => {
        // Refresh captcha when step changes to AUTH
        if (step === 'AUTH') {
            setCaptchaCode(generateCaptcha());
            setCaptchaInput('');
            setPassword('');
        }
    }, [step]);

    const handlePhoneSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (phone.length < 10) {
            showToast('Please enter a valid mobile number (min 10 digits)', 'error');
            return;
        }

        setLoading(true);
        try {
            const status = await MockService.checkUserStatus(phone);
            
            if (status.exists) {
                // User exists (Created by Admin or previous Admin), allow login
                setUserExists(true);
                setTargetRole(status.role);
                setStep('AUTH');
            } else {
                // User does not exist
                if (status.nextUserRole === UserRole.ADMIN) {
                     // First user ever -> Allow Admin Setup
                     setUserExists(false);
                     setTargetRole(UserRole.ADMIN);
                     setStep('AUTH');
                     showToast('Welcome. Please set up the Admin account.', 'info');
                } else {
                     // Regular customer trying to sign up -> BLOCK
                     showToast('Account not found. Please ask the Admin to create your account.', 'error');
                }
            }
        } catch (error) {
            console.error(error);
            showToast('Error checking user status. Check database connection.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleAuthSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        if (targetRole === UserRole.ADMIN) {
            if (!password) {
                showToast('Password is required for Admin access', 'error');
                setLoading(false);
                return;
            }
        } else {
            if (captchaInput !== captchaCode) {
                showToast('Incorrect captcha code', 'error');
                setCaptchaCode(generateCaptcha());
                setCaptchaInput('');
                setLoading(false);
                return;
            }
        }

        try {
            const isRegistering = !userExists;
            const user = await MockService.authenticate(phone, password, isRegistering);
            
            if (user) {
                window.location.hash = '/';
                // PERSIST SESSION
                localStorage.setItem('LC_CURRENT_USER', JSON.stringify(user));
                onLogin(user);
                showToast(isRegistering ? 'Account created successfully!' : `Welcome back, ${user.name}!`, 'success');
            }
        } catch (error: any) {
            let msg = error.message || 'Authentication failed';
            
            if (msg.toLowerCase().includes('database error')) {
                msg = 'Database Error: Please ensure you have run the SQL script.';
            }
            
            showToast(msg, 'error');
        } finally {
            setLoading(false);
        }
    };

    const resetFlow = () => {
        setStep('PHONE');
        setPhone('');
        setPassword('');
        setCaptchaInput('');
    };

    const handleResetData = () => {
        if(confirm('This will clear all local data. This helps if you are stuck in a login loop. Continue?')) {
            MockService.factoryReset();
        }
    };

    const getGreeting = () => {
        if (!userExists) return targetRole === UserRole.ADMIN ? "Setup Admin" : "Account Required";
        return targetRole === UserRole.ADMIN ? "Admin Login" : "Customer Login";
    };

    const getSubtext = () => {
        if (!userExists && targetRole === UserRole.ADMIN) return "You are the first user. Please set up your password.";
        if (targetRole === UserRole.ADMIN) return "Please enter your secure password.";
        return "Please enter the verification code below.";
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4 font-sans pb-24">
            <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden border border-gray-100">
                <div className={`${targetRole === UserRole.ADMIN && step === 'AUTH' ? 'bg-gray-800' : 'bg-blue-600'} p-8 text-center text-white transition-colors duration-300`}>
                    <div className="mx-auto w-16 h-16 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center mb-4">
                        {targetRole === UserRole.ADMIN && step === 'AUTH' ? <Shield size={32} /> : <Lock size={32} />}
                    </div>
                    <h1 className="text-2xl font-bold">{step === 'PHONE' ? t.login_title : getGreeting()}</h1>
                    <p className="text-blue-100 mt-2 text-sm opacity-90">
                        {step === 'PHONE' ? 'Secure ledger & debt management' : getSubtext()}
                    </p>
                </div>

                <div className="p-8">
                    {step === 'PHONE' ? (
                        <form onSubmit={handlePhoneSubmit} className="space-y-5">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Mobile Number</label>
                                <div className="relative">
                                    <div className="absolute left-0 top-0 bottom-0 pl-4 flex items-center pointer-events-none">
                                        <span className="text-gray-500 font-medium border-r border-gray-300 pr-2 mr-2">🇵🇭 +63</span>
                                    </div>
                                    <input 
                                        type="tel"
                                        required
                                        placeholder="917 123 4567"
                                        value={phone}
                                        onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ''))}
                                        className="w-full pl-24 pr-4 py-3 rounded-xl bg-white border-2 border-gray-300 text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all font-medium placeholder-gray-500"
                                    />
                                </div>
                            </div>
                            
                            <button 
                                type="submit" 
                                disabled={loading || phone.length < 10}
                                className="w-full bg-blue-600 text-white py-3.5 rounded-xl font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center"
                            >
                                {loading ? 'Checking...' : t.send_code}
                                {!loading && <ArrowRight size={18} className="ml-2" />}
                            </button>
                        </form>
                    ) : (
                        <form onSubmit={handleAuthSubmit} className="space-y-6">
                            <div className="text-center mb-4">
                                <p className="text-gray-500 text-sm">{userExists ? 'Logging in as' : 'Setting Up'}</p>
                                <p className="font-bold text-gray-800 text-lg">+63 {phone}</p>
                            </div>

                            {targetRole === UserRole.ADMIN && (
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        {userExists ? 'Enter Password' : 'Create Password'}
                                    </label>
                                    <input 
                                        type="password"
                                        required
                                        placeholder="••••••••"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full px-4 py-3 rounded-xl bg-white border-2 border-gray-300 text-gray-900 focus:ring-2 focus:ring-gray-500 focus:border-gray-500 outline-none placeholder-gray-500"
                                    />
                                </div>
                            )}

                            {targetRole === UserRole.CUSTOMER && (
                                <div className="space-y-4">
                                    <div className="bg-gray-100 p-4 rounded-xl flex items-center justify-between border border-gray-200">
                                        <span className="text-3xl font-mono font-bold text-gray-600 tracking-widest select-none">
                                            {captchaCode}
                                        </span>
                                        <button 
                                            type="button" 
                                            onClick={() => setCaptchaCode(generateCaptcha())}
                                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-full"
                                        >
                                            <RefreshCw size={20} />
                                        </button>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">Enter Code</label>
                                        <input 
                                            type="tel"
                                            required
                                            maxLength={4}
                                            placeholder="0000"
                                            value={captchaInput}
                                            onChange={(e) => setCaptchaInput(e.target.value)}
                                            className="w-full text-center px-4 py-3 rounded-xl bg-white border-2 border-gray-300 text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-mono text-lg tracking-widest placeholder-gray-500"
                                        />
                                    </div>
                                </div>
                            )}
                            
                            <button 
                                type="submit" 
                                disabled={loading}
                                className={`w-full text-white py-3.5 rounded-xl font-bold transition-colors shadow-lg disabled:opacity-50 ${targetRole === UserRole.ADMIN ? 'bg-gray-800 hover:bg-gray-900 shadow-gray-500/20' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20'}`}
                            >
                                {loading ? 'Verifying...' : (userExists ? t.verify_login : 'Complete Setup')}
                            </button>
                            
                            <button 
                                type="button"
                                onClick={resetFlow}
                                className="w-full text-gray-500 text-sm hover:text-gray-700 mt-2"
                            >
                                Change Number
                            </button>

                            {!userExists && targetRole === UserRole.ADMIN && (
                                <div className="flex items-start bg-amber-50 p-3 rounded-lg border border-amber-100 mt-4">
                                    <AlertTriangle size={16} className="text-amber-600 mt-0.5 mr-2 shrink-0" />
                                    <p className="text-xs text-amber-800 leading-relaxed">
                                        <strong>Setup Tip:</strong> Ensure "Confirm Email" is disabled in your Supabase Auth settings, as this app uses phone numbers for login.
                                    </p>
                                </div>
                            )}
                        </form>
                    )}

                    <div className="mt-8 pt-6 border-t border-gray-100 text-center">
                        <button onClick={handleResetData} className="text-xs text-gray-400 hover:text-gray-600 underline block w-full mb-2">
                            Trouble logging in? Reset App Data
                        </button>
                        <span className="text-[10px] text-gray-300 font-mono">v{CONFIG.APP_VERSION}</span>
                    </div>
                </div>
            </div>
            
            <AdBanner />
        </div>
    );
};