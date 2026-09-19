// ===================== ACTIVATION SYSTEM CONSTANTS =====================
const ACTIVATION_CODES_KEY = 'sub_activation_codes';
const TRIAL_START_KEY = 'sub_trial_start';
const ACTIVATED_KEY = 'sub_activated';
const ADMIN_DEVICES_KEY = 'sub_admin_devices';
const ALL_DEVICES_KEY = 'sub_all_devices';  // All devices that visited the site
const IS_ADMIN_KEY = 'sub_is_admin';
const ADMIN_SECRET_CODE_KEY = 'sub_admin_secret';
const DEVICE_ID_KEY = 'sub_device_id';

const TRIAL_HOURS = 24;
const MAX_ADMIN_DEVICES = 2;
const PRICE_EGP = 299;
const CODE_LENGTH = 6;

// ===================== WHATSAPP PAYMENT / GOOGLE SHEETS =====================
const SHEETS_VERIFY_URL_KEY = 'sub_sheets_verify_url';
const SHEETS_VERIFY_SECRET_KEY = 'sub_sheets_verify_secret';
const DEFAULT_SHEETS_VERIFY_URL = 'https://script.google.com/macros/s/AKfycbxtpjI5Q1nwca50RCuBq-ec8UR1m6VAPH3OLn--J3iQJIcMJWtaF_CfTfZZw9dOB7nO3Q/exec';

function getSheetsVerifyUrl() {
    return localStorage.getItem(SHEETS_VERIFY_URL_KEY) || DEFAULT_SHEETS_VERIFY_URL;
}

function getSheetsVerifySecret() {
    return localStorage.getItem(SHEETS_VERIFY_SECRET_KEY) || '';
}

async function markWhatsAppPaymentUsed(phone, amount) {
    const url = getSheetsVerifyUrl();
    const secret = getSheetsVerifySecret();
    if (!url || !secret) {
        return { success: false, message: 'إعداد ربط الشيت ناقص. افتح الإعدادات واحفظ VERIFY_SECRET.' };
    }
    const params = new URLSearchParams({
        action: 'verify_and_use',
        phone: String(phone || ''),
        amount: String(amount || ''),
        secret
    });
    try {
        const res = await fetch(url + '?' + params.toString(), { method: 'GET', cache: 'no-store' });
        const data = await res.json();
        return data || { success: false, message: 'رد غير صالح من الشيت.' };
    } catch (err) {
        console.error('WhatsApp payment sheet error:', err);
        return { success: false, message: 'تعذر الاتصال بالشيت. تأكد من إعداد الربط.' };
    }
}

let countdownInterval = null;
let isAdminLoggedIn = false;

// ===================== DEVICE ID =====================
function getDeviceId() {
    let deviceId = localStorage.getItem(DEVICE_ID_KEY);
    if (!deviceId) {
        deviceId = 'dev_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem(DEVICE_ID_KEY, deviceId);
    }
    return deviceId;
}

// ===================== ADMIN SECRET CODE =====================
function saveAdminSecretCode(code) {
    if (!code || code.length !== CODE_LENGTH) {
        showNotification('⚠️ الكود لازم يكون 6 أحرف/أرقام', 'warning');
        return false;
    }
    localStorage.setItem(ADMIN_SECRET_CODE_KEY, code.toUpperCase());
    showNotification('✅ تم حفظ كود الأدمن بنجاح!', 'success');
    playSound('success');
    return true;
}

function getAdminSecretCode() {
    return localStorage.getItem(ADMIN_SECRET_CODE_KEY) || 'TAMM9';
}

function saveAdminSecretCodeFromSettings() {
    const input = document.getElementById('adminSecretCodeInput');
    if (!input) return;
    const code = input.value.trim().toUpperCase();
    if (saveAdminSecretCode(code)) {
        input.value = '';
    }
}

function toggleAdminCodeVisibility() {
    const input = document.getElementById('adminSecretCodeInput');
    const eye = document.getElementById('adminCodeEye');
    if (!input || !eye) return;

    if (input.type === 'password') {
        input.type = 'text';
        eye.className = 'fas fa-eye-slash';
    } else {
        input.type = 'password';
        eye.className = 'fas fa-eye';
    }
}

// ===================== TRIAL MANAGEMENT =====================
function getTrialStart() {
    let start = localStorage.getItem(TRIAL_START_KEY);
    if (!start) {
        start = Date.now().toString();
        localStorage.setItem(TRIAL_START_KEY, start);
        console.log('🆕 Trial started at:', new Date(parseInt(start)).toLocaleString());
    }
    return parseInt(start);
}

function getTrialTimeLeft() {
    const start = getTrialStart();
    const now = Date.now();
    const trialEnd = start + (TRIAL_HOURS * 60 * 60 * 1000);
    const totalMs = trialEnd - now;

    if (totalMs <= 0) {
        return { hours: 0, minutes: 0, seconds: 0, totalMs: 0, expired: true };
    }

    const hours = Math.floor(totalMs / (1000 * 60 * 60));
    const minutes = Math.floor((totalMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((totalMs % (1000 * 60)) / 1000);

    return { hours, minutes, seconds, totalMs, expired: false };
}

function isActivated() {
    return localStorage.getItem(ACTIVATED_KEY) === 'true';
}

function isAdmin() {
    return localStorage.getItem(IS_ADMIN_KEY) === 'true';
}

function checkTrialStatus() {
    // Admin always has access
    if (isAdmin()) return true;
    // Activated users always have access
    if (isActivated()) return true;
    // Trial users: check if time remains
    const timeLeft = getTrialTimeLeft();
    if (!timeLeft.expired) return true;
    // Trial expired and not activated → lock
    return false;
}

// ===================== COUNTDOWN =====================
function startTrialCountdown() {
    updateLockScreenCountdown();

    if (countdownInterval) clearInterval(countdownInterval);

    countdownInterval = setInterval(() => {
        updateLockScreenCountdown();
    }, 1000);
}

function updateLockScreenCountdown() {
    const timeLeft = getTrialTimeLeft();
    const countdownEl = document.getElementById('trialCountdown');

    if (!countdownEl) return;

    if (timeLeft.expired) {
        countdownEl.innerHTML = '<span style="color: var(--danger);">00:00:00</span>';
        countdownEl.className = 'trial-countdown red';
        return;
    }

    const h = String(timeLeft.hours).padStart(2, '0');
    const m = String(timeLeft.minutes).padStart(2, '0');
    const s = String(timeLeft.seconds).padStart(2, '0');

    countdownEl.innerHTML = `${h}:${m}:${s}`;

    // Update color based on time left
    countdownEl.classList.remove('green', 'yellow', 'red');
    if (timeLeft.hours > 6) {
        countdownEl.classList.add('green');
    } else if (timeLeft.hours >= 1) {
        countdownEl.classList.add('yellow');
    } else {
        countdownEl.classList.add('red');
    }
}

// ===================== LOCK SCREEN =====================

// ===================== TRIAL WIDGET (Dashboard) =====================
function updateTrialWidget() {
    const widget = document.getElementById('trialWidget');
    const timerEl = document.getElementById('trialWidgetTimer');
    const statusEl = document.getElementById('trialWidgetStatus');
    const labelEl = document.getElementById('trialWidgetLabel');

    if (!widget || !timerEl || !statusEl) return;

    // Case 1: Admin - show admin badge, NO countdown
    if (isAdmin()) {
        widget.style.display = 'flex';
        if (labelEl) labelEl.textContent = 'حساب الأدمن';
        timerEl.textContent = '👑 أدمن';
        statusEl.textContent = 'مفعل';
        statusEl.className = 'trial-widget-status admin';
        widget.classList.remove('green', 'yellow', 'red');
        // Stop interval if running
        if (window.trialWidgetInterval) {
            clearInterval(window.trialWidgetInterval);
            window.trialWidgetInterval = null;
        }
        return;
    }

    // Case 2: Activated with code - show activated, NO countdown, hide widget
    if (isActivated()) {
        widget.style.display = 'none'; // HIDE completely for activated users
        if (window.trialWidgetInterval) {
            clearInterval(window.trialWidgetInterval);
            window.trialWidgetInterval = null;
        }
        return;
    }

    // Case 3: Trial active - show countdown
    const timeLeft = getTrialTimeLeft();

    if (timeLeft.expired) {
        widget.style.display = 'none';
        if (window.trialWidgetInterval) {
            clearInterval(window.trialWidgetInterval);
            window.trialWidgetInterval = null;
        }
        return;
    }

    widget.style.display = 'flex';
    if (labelEl) labelEl.textContent = 'الوقت المتبقي';
    statusEl.textContent = 'تجريبي';
    statusEl.className = 'trial-widget-status';

    const h = String(timeLeft.hours).padStart(2, '0');
    const m = String(timeLeft.minutes).padStart(2, '0');
    const s = String(timeLeft.seconds).padStart(2, '0');
    timerEl.textContent = `${h}:${m}:${s}`;

    // Color states
    widget.classList.remove('green', 'yellow', 'red');
    if (timeLeft.hours > 6) {
        widget.classList.add('green');
    } else if (timeLeft.hours >= 1) {
        widget.classList.add('yellow');
    } else {
        widget.classList.add('red');
    }
}

function startTrialWidget() {
    // Clear any existing interval first
    if (window.trialWidgetInterval) {
        clearInterval(window.trialWidgetInterval);
        window.trialWidgetInterval = null;
    }

    updateTrialWidget();

    // Only start interval for trial users (not admin, not activated)
    if (!isActivated() && !isAdmin() && !getTrialTimeLeft().expired) {
        window.trialWidgetInterval = setInterval(updateTrialWidget, 1000);
    }
}


function showLockScreen() {
    const lockScreen = document.getElementById('trialLockScreen');
    const mainContent = document.getElementById('mainContent');
    const sidebar = document.getElementById('mainSidebar');

    if (lockScreen) {
        lockScreen.style.display = 'flex';
        startTrialCountdown();
        initCodeInputs();

        // Update lock screen message based on status
        const timeLeft = getTrialTimeLeft();
        const titleEl = lockScreen.querySelector('.trial-lock-title');
        const textEl = lockScreen.querySelector('.trial-lock-text');

        if (timeLeft.expired) {
            // Trial fully expired
            if (titleEl) titleEl.textContent = 'انتهت الفترة التجريبية!';
            if (textEl) {
                textEl.innerHTML = 'لقد انتهت الفترة التجريبية المجانية (24 ساعة)<br>تواصل معنا على واتساب لتفعيل اشتراكك بـ 299 ج.م';
            }
        } else {
            // Still in trial but somehow on lock screen (shouldn't happen normally)
            if (titleEl) titleEl.textContent = 'الفترة التجريبية';
            if (textEl) {
                textEl.innerHTML = 'لديك فترة تجريبية 24 ساعة<br>استمتع باستخدام النظام';
            }
        }
    }

    if (mainContent) mainContent.style.display = 'none';
    if (sidebar) sidebar.style.display = 'none';

    // Hide mobile menu toggle
    const mobileToggle = document.getElementById('mobileMenuToggle');
    if (mobileToggle) mobileToggle.style.display = 'none';
}

function hideLockScreen() {
    const lockScreen = document.getElementById('trialLockScreen');
    const mainContent = document.getElementById('mainContent');
    const sidebar = document.getElementById('mainSidebar');

    if (lockScreen) lockScreen.style.display = 'none';
    if (mainContent) mainContent.style.display = 'block';
    if (sidebar) sidebar.style.display = 'block';

    // Show mobile menu toggle
    const mobileToggle = document.getElementById('mobileMenuToggle');
    if (mobileToggle) mobileToggle.style.display = 'flex';

    if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
    }
}

// ===================== CODE INPUTS =====================
function initCodeInputs() {
    const inputs = document.querySelectorAll('.code-digit:not(.admin-login-digit):not(.settings-code-digit)');
    inputs.forEach((input, index) => {
        // Remove old listeners to avoid duplicates
        const newInput = input.cloneNode(true);
        input.parentNode.replaceChild(newInput, input);
    });

    const freshInputs = document.querySelectorAll('.code-digit:not(.admin-login-digit)');

    freshInputs.forEach((input, index) => {
        input.addEventListener('input', (e) => {
            const val = e.target.value;
            if (val.length === 1) {
                e.target.classList.add('filled');
                if (index < freshInputs.length - 1) {
                    freshInputs[index + 1].focus();
                }
            } else if (val.length === 0) {
                e.target.classList.remove('filled');
            }
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && !e.target.value && index > 0) {
                freshInputs[index - 1].focus();
                freshInputs[index - 1].classList.remove('filled');
            }
            if (e.key === 'Enter') {
                activateWithCode();
            }
        });

        input.addEventListener('paste', (e) => {
            e.preventDefault();
            const pasteData = e.clipboardData.getData('text').trim().toUpperCase();
            if (pasteData.length === CODE_LENGTH) {
                freshInputs.forEach((inp, i) => {
                    inp.value = pasteData[i] || '';
                    if (pasteData[i]) inp.classList.add('filled');
                });
                freshInputs[freshInputs.length - 1].focus();
            }
        });
    });
}

function getEnteredCode() {
    const inputs = document.querySelectorAll('.code-digit:not(.admin-login-digit)');
    let code = '';
    inputs.forEach(input => {
        code += input.value.toUpperCase();
    });
    return code;
}

function clearCodeInputs() {
    const inputs = document.querySelectorAll('.code-digit:not(.admin-login-digit)');
    inputs.forEach(input => {
        input.value = '';
        input.classList.remove('filled');
    });
}

// ===================== ACTIVATION =====================
function generateActivationCode() {
    // Pattern: 2 letters + 4 numbers (e.g., AB1234)
    // This creates a verifiable format without needing cross-browser storage
    const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const numbers = '23456789';
    let code = '';

    // 2 random letters
    code += letters.charAt(Math.floor(Math.random() * letters.length));
    code += letters.charAt(Math.floor(Math.random() * letters.length));

    // 4 random numbers
    code += numbers.charAt(Math.floor(Math.random() * numbers.length));
    code += numbers.charAt(Math.floor(Math.random() * numbers.length));
    code += numbers.charAt(Math.floor(Math.random() * numbers.length));
    code += numbers.charAt(Math.floor(Math.random() * numbers.length));

    return code;
}

function isValidActivationCode(code) {
    // Validate pattern: 2 uppercase letters + 4 numbers
    const pattern = /^[A-Z]{2}[2-9]{4}$/;
    return pattern.test(code);
}

function saveActivationCode(code) {
    let codes = JSON.parse(localStorage.getItem(ACTIVATION_CODES_KEY) || '[]');
    if (!codes.includes(code)) {
        codes.push(code);
        localStorage.setItem(ACTIVATION_CODES_KEY, JSON.stringify(codes));
    }
    return code;
}

function getActivationCodes() {
    return JSON.parse(localStorage.getItem(ACTIVATION_CODES_KEY) || '[]');
}

function removeActivationCode(code) {
    let codes = getActivationCodes();
    codes = codes.filter(c => c !== code);
    localStorage.setItem(ACTIVATION_CODES_KEY, JSON.stringify(codes));
}

function activateWithCode() {
    const code = getEnteredCode();
    const errorEl = document.getElementById('activationError');

    if (code.length !== CODE_LENGTH) {
        if (errorEl) {
            errorEl.textContent = '⚠️ أكمل الـ 6 خانات';
            errorEl.style.display = 'block';
        }
        return;
    }

    // Validate code pattern: 2 letters + 4 numbers
    if (!isValidActivationCode(code)) {
        if (errorEl) {
            errorEl.textContent = '⚠️ الكود غير صالح. الصيغة: حرفين + 4 أرقام (مثال: AB1234)';
            errorEl.style.display = 'block';
        }
        playSound('alert');
        shakeCodeInputs();
        return;
    }

    // Activate the device
    localStorage.setItem(ACTIVATED_KEY, 'true');

    // Update device status in all devices list
    updateDeviceActivationStatus();

    if (errorEl) errorEl.style.display = 'none';
    clearCodeInputs();

    showNotification('✅ تم التفعيل بنجاح! مرحباً بيك في Stack Manager', 'success');
    playSound('success');

    hideLockScreen();
    renderAll();
}

function shakeCodeInputs() {
    const inputs = document.querySelectorAll('.code-digit:not(.admin-login-digit)');
    inputs.forEach(input => {
        input.style.borderColor = 'var(--danger)';
        setTimeout(() => {
            input.style.borderColor = '';
        }, 1000);
    });
}

function updateDeviceActivationStatus() {
    let devices = getAllDevices();
    const deviceId = getDeviceId();
    const device = devices.find(d => d.id === deviceId);
    if (device) {
        device.activated = true;
        localStorage.setItem(ALL_DEVICES_KEY, JSON.stringify(devices));
    }
}

// ===================== ADMIN LOGIN =====================
function showAdminLogin() {
    const modal = document.getElementById('adminLoginModal');
    if (modal) {
        modal.style.display = 'flex';
        modal.classList.add('show');

        // Init admin login digits
        const inputs = document.querySelectorAll('.admin-login-digit');
        inputs.forEach((input, index) => {
            const newInput = input.cloneNode(true);
            input.parentNode.replaceChild(newInput, input);
        });

        const freshInputs = document.querySelectorAll('.admin-login-digit');
        freshInputs.forEach((input, index) => {
            input.addEventListener('input', (e) => {
                const val = e.target.value;
                if (val.length === 1) {
                    e.target.classList.add('filled');
                    if (index < freshInputs.length - 1) {
                        freshInputs[index + 1].focus();
                    }
                } else if (val.length === 0) {
                    e.target.classList.remove('filled');
                }
            });

            input.addEventListener('keydown', (e) => {
                if (e.key === 'Backspace' && !e.target.value && index > 0) {
                    freshInputs[index - 1].focus();
                    freshInputs[index - 1].classList.remove('filled');
                }
                if (e.key === 'Enter') {
                    verifyAdminLogin();
                }
            });
        });

        setTimeout(() => freshInputs[0]?.focus(), 100);
    }
}

function closeAdminLogin() {
    const modal = document.getElementById('adminLoginModal');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('show');
    }
    const errorEl = document.getElementById('adminLoginError');
    if (errorEl) errorEl.style.display = 'none';

    // Clear inputs
    const inputs = document.querySelectorAll('.admin-login-digit');
    inputs.forEach(input => {
        input.value = '';
        input.classList.remove('filled');
    });
}

function getAdminLoginCode() {
    const inputs = document.querySelectorAll('.admin-login-digit');
    let code = '';
    inputs.forEach(input => {
        code += input.value.toUpperCase();
    });
    return code;
}

function verifyAdminLogin() {
    const code = getAdminLoginCode();
    const errorEl = document.getElementById('adminLoginError');
    const secretCode = getAdminSecretCode();

    if (code === secretCode) {
        // Successful admin login
        isAdminLoggedIn = true;
        localStorage.setItem(IS_ADMIN_KEY, 'true');

        // Register device
        registerAdminDevice();

        if (errorEl) errorEl.style.display = 'none';
        closeAdminLogin();

        // If coming from lock screen, hide it
        if (!checkTrialStatus()) {
            hideLockScreen();
        }

        showAdminPanel();
        showNotification('👑 تم تسجيل دخول الأدمن بنجاح!', 'success');
        playSound('success');
    } else {
        if (errorEl) {
            errorEl.textContent = '⚠️ كود الأدمن غير صحيح';
            errorEl.style.display = 'block';
        }
        playSound('alert');
    }
}

// ===================== DEVICE REGISTRATION =====================
function registerDevice() {
    let devices = JSON.parse(localStorage.getItem(ALL_DEVICES_KEY) || '[]');
    const deviceId = getDeviceId();
    const now = new Date().toLocaleDateString('ar-EG');
    const currentTime = new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });

    // Check if device already registered
    const existingIndex = devices.findIndex(d => d.id === deviceId);
    if (existingIndex !== -1) {
        // Update last visit time
        devices[existingIndex].lastVisit = now + ' ' + currentTime;
        devices[existingIndex].visitCount = (devices[existingIndex].visitCount || 1) + 1;
        // Update status in case it changed
        devices[existingIndex].isAdmin = isAdmin();
        devices[existingIndex].activated = isActivated();
    } else {
        const deviceName = getDeviceName();
        const isAdminDevice = isAdmin();
        const isActivatedDevice = isActivated();

        // Determine status label
        let status = 'زائر';
        if (isAdminDevice) status = 'أدمن';
        else if (isActivatedDevice) status = 'مفعل';

        devices.push({
            id: deviceId,
            name: deviceName,
            date: now,
            time: currentTime,
            lastVisit: now + ' ' + currentTime,
            visitCount: 1,
            isAdmin: isAdminDevice,
            activated: isActivatedDevice,
            status: status
        });
    }

    localStorage.setItem(ALL_DEVICES_KEY, JSON.stringify(devices));
    console.log('📱 Device registered/updated:', deviceId, 'Total devices:', devices.length);
}

// Keep old function for backward compatibility
function registerAdminDevice() {
    registerDevice(); // Now registers ALL devices

    // Also keep admin devices list for the 2-device limit
    let adminDevices = JSON.parse(localStorage.getItem(ADMIN_DEVICES_KEY) || '[]');
    const deviceId = getDeviceId();
    const now = new Date().toLocaleDateString('ar-EG');

    if (!adminDevices.find(d => d.id === deviceId)) {
        if (adminDevices.length >= MAX_ADMIN_DEVICES) {
            adminDevices.shift();
        }
        adminDevices.push({
            id: deviceId,
            name: getDeviceName(),
            date: now
        });
        localStorage.setItem(ADMIN_DEVICES_KEY, JSON.stringify(adminDevices));
    }
}

function getDeviceName() {
    const ua = navigator.userAgent;
    if (/Android/.test(ua)) return '📱 Android';
    if (/iPhone|iPad|iPod/.test(ua)) return '🍎 iPhone/iPad';
    if (/Windows/.test(ua)) return '💻 Windows';
    if (/Mac/.test(ua)) return '🖥️ Mac';
    if (/Linux/.test(ua)) return '🐧 Linux';
    return '🌐 متصفح';
}

function getAllDevices() {
    return JSON.parse(localStorage.getItem(ALL_DEVICES_KEY) || '[]');
}

function getAdminDevices() {
    return JSON.parse(localStorage.getItem(ADMIN_DEVICES_KEY) || '[]');
}

function deleteDevice(deviceId) {
    if (!confirm('هل أنت متأكد من حذف هذا الجهاز؟')) return;

    let devices = getAllDevices();
    devices = devices.filter(d => d.id !== deviceId);
    localStorage.setItem(ALL_DEVICES_KEY, JSON.stringify(devices));

    // Also remove from admin devices if exists
    let adminDevices = getAdminDevices();
    adminDevices = adminDevices.filter(d => d.id !== deviceId);
    localStorage.setItem(ADMIN_DEVICES_KEY, JSON.stringify(adminDevices));

    renderAdminDevices();
    showNotification('🗑️ تم حذف الجهاز', 'success');
    playSound('success');
}

// ===================== ADMIN PANEL =====================
function showAdminPanel() {
    const modal = document.getElementById('adminPanelModal');
    if (modal) {
        modal.style.display = 'flex';
        modal.classList.add('show');
        renderAdminDevices();
    }
}

function closeAdminPanel() {
    const modal = document.getElementById('adminPanelModal');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('show');
    }

    // Hide generated code
    const codeBox = document.getElementById('generatedCodeBox');
    if (codeBox) codeBox.style.display = 'none';
}

function generateAndShowCode() {
    const code = generateActivationCode();

    // Store in a simple list for this session (not for cross-browser validation)
    // This is just for the admin to see what codes they've generated recently
    let recentCodes = JSON.parse(sessionStorage.getItem('sub_recent_codes') || '[]');
    recentCodes.unshift({ code: code, created: new Date().toLocaleString('ar-EG') });
    if (recentCodes.length > 10) recentCodes.pop(); // Keep last 10
    sessionStorage.setItem('sub_recent_codes', JSON.stringify(recentCodes));

    const codeBox = document.getElementById('generatedCodeBox');
    const codeValue = document.getElementById('generatedCodeValue');

    if (codeValue) codeValue.textContent = code;
    if (codeBox) {
        codeBox.style.display = 'block';
        codeBox.style.animation = 'none';
        codeBox.offsetHeight; // Trigger reflow
        codeBox.style.animation = 'fadeIn 0.4s ease';
    }

    showNotification('✅ تم توليد كود جديد: ' + code, 'success');
    playSound('success');
}

function copyGeneratedCode() {
    const codeValue = document.getElementById('generatedCodeValue');
    if (!codeValue) return;

    const code = codeValue.textContent;

    if (navigator.clipboard) {
        navigator.clipboard.writeText(code).then(() => {
            showNotification('📋 تم نسخ الكود!', 'success');
        });
    } else {
        // Fallback
        const textarea = document.createElement('textarea');
        textarea.value = code;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showNotification('📋 تم نسخ الكود!', 'success');
    }
}

function renderAdminDevices() {
    const container = document.getElementById('adminDevicesList');
    if (!container) return;

    const devices = getAllDevices();

    if (devices.length === 0) {
        container.innerHTML = '<p style="color: var(--gray); text-align: center; padding: 20px;">لا توجد أجهزة مسجلة</p>';
        return;
    }

    container.innerHTML = devices.map(d => {
        // Determine status badge based on device status
        let statusBadge = '';
        if (d.isAdmin) {
            statusBadge = '<span class="device-badge admin">👑 أدمن</span>';
        } else if (d.activated) {
            statusBadge = '<span class="device-badge activated">✅ مفعل</span>';
        } else {
            statusBadge = '<span class="device-badge trial">⏳ تجريبي</span>';
        }

        return `
        <div class="admin-device-item">
            <div class="admin-device-icon">${d.name.split(' ')[0]}</div>
            <div class="admin-device-info">
                <div class="admin-device-name">
                    ${d.name}
                    ${statusBadge}
                </div>
                <div class="admin-device-date">
                    <i class="far fa-clock" style="font-size: 10px;"></i> ${d.lastVisit || d.date + ' ' + d.time}
                </div>
            </div>
            <button class="device-delete-btn" onclick="deleteDevice('${d.id}')" title="حذف الجهاز">
                <i class="fas fa-trash-alt"></i>
            </button>
        </div>
    `}).join('');
}

function clearAllActivations() {
    if (!confirm('⚠️ هل أنت متأكد؟ هيتمسح كل التفعيلات والأكواد!')) return;

    localStorage.removeItem(ACTIVATED_KEY);
    localStorage.removeItem(ACTIVATION_CODES_KEY);
    localStorage.removeItem(IS_ADMIN_KEY);
    localStorage.removeItem(ADMIN_DEVICES_KEY);
    localStorage.removeItem(TRIAL_START_KEY);

    isAdminLoggedIn = false;

    showNotification('🗑️ تم مسح كل التفعيلات', 'success');
    closeAdminPanel();

    // Restart trial
    setTimeout(() => {
        location.reload();
    }, 1500);
}

// ===================== SETTINGS ADMIN ACCESS =====================
let settingsAdminVerified = false;

function verifySettingsAdminCode() {
    const input = document.getElementById('settingsAdminCodeInput');
    const errorEl = document.getElementById('settingsAdminError');
    const controlsArea = document.getElementById('adminControlsArea');
    const loginForm = document.getElementById('adminLoginForm');

    if (!input || !errorEl || !controlsArea || !loginForm) return;

    const enteredCode = input.value.trim().toUpperCase();
    const secretCode = getAdminSecretCode();

    if (enteredCode === secretCode) {
        // Correct code - save admin status permanently
        localStorage.setItem(IS_ADMIN_KEY, 'true');
        isAdminLoggedIn = true;
        settingsAdminVerified = true;

        errorEl.style.display = 'none';
        input.value = '';

        // Hide login form, show controls
        loginForm.style.display = 'none';
        controlsArea.style.display = 'block';

        // Update trial widget to show admin
        updateTrialWidget();

        showNotification('👑 تم الدخول لمنطقة الأدمن', 'success');
        playSound('success');
    } else {
        // Wrong code
        errorEl.style.display = 'block';
        input.value = '';
        playSound('alert');

        // Shake animation
        input.style.borderColor = 'var(--danger)';
        setTimeout(() => {
            input.style.borderColor = '';
        }, 1000);
    }
}

function handleGenerateCodeClick() {
    if (settingsAdminVerified || isAdminLoggedIn || isAdmin()) {
        // Already admin, show panel directly
        showAdminPanel();
    } else {
        // Need to login first
        showAdminLogin();
    }
}

// Reset admin verification when closing settings
function resetSettingsAdminAccess() {
    settingsAdminVerified = false;
    const loginForm = document.getElementById('adminLoginForm');
    const controlsArea = document.getElementById('adminControlsArea');
    const input = document.getElementById('settingsAdminCodeInput');
    const errorEl = document.getElementById('settingsAdminError');

    if (loginForm) loginForm.style.display = 'block';
    if (controlsArea) controlsArea.style.display = 'none';
    if (input) input.value = '';
    if (errorEl) errorEl.style.display = 'none';
}

// ===================== INIT ACTIVATION SYSTEM =====================
function initActivationSystem() {
    console.log('🔐 Initializing activation system...');

    // Check if admin is logged in from localStorage
    if (localStorage.getItem(IS_ADMIN_KEY) === 'true') {
        isAdminLoggedIn = true;
        console.log('👑 Admin status loaded from localStorage');
    }

    // Register this device (ALL visitors get registered)
    registerDevice();

    const timeLeft = getTrialTimeLeft();

    // Case 1: Admin → always open, show admin badge
    if (isAdmin() || isAdminLoggedIn) {
        console.log('👑 Admin detected - full access');
        hideLockScreen();
        startTrialWidget();
        return;
    }

    // Case 2: Activated with code → always open, hide widget
    if (isActivated()) {
        console.log('✅ User activated - full access');
        hideLockScreen();
        startTrialWidget();
        return;
    }

    // Case 3: Trial active → open with countdown
    if (!timeLeft.expired) {
        console.log('⏳ Trial active - ' + timeLeft.hours + 'h ' + timeLeft.minutes + 'm remaining');
        hideLockScreen();
        startTrialCountdown();
        startTrialWidget();
        return;
    }

    // Case 4: Trial expired → show lock screen
    console.log('🔒 Trial expired - showing lock screen');
    showLockScreen();
}

// ===================== OVERRIDE showSection TO CHECK ACTIVATION =====================
const originalShowSection = showSection;
showSection = function(sectionId) {
    // Admin always has access
    if (isAdmin()) {
        originalShowSection(sectionId);
        return;
    }
    // Activated users always have access
    if (isActivated()) {
        originalShowSection(sectionId);
        return;
    }
    // Trial users: check if still valid
    if (!checkTrialStatus()) {
        showLockScreen();
        return;
    }
    originalShowSection(sectionId);
};

// ===================== OVERRIDE openSettingsModal TO CHECK ACTIVATION =====================
const originalOpenSettingsModal = openSettingsModal;
openSettingsModal = function() {
    // Admin always has access
    if (isAdmin()) {
        originalOpenSettingsModal();
        return;
    }
    // Activated users always have access
    if (isActivated()) {
        originalOpenSettingsModal();
        return;
    }
    // Trial users: check if still valid
    if (!checkTrialStatus()) {
        showLockScreen();
        return;
    }
    originalOpenSettingsModal();
};


// ===================== DATA STORE =====================
function loadData() {
    try {
        const c = localStorage.getItem('sub_customers');
        const s = localStorage.getItem('sub_services');
        const e = localStorage.getItem('sub_expenses');
        const sup = localStorage.getItem('sub_suppliers');
        const act = localStorage.getItem('sub_activity_log');
        const subh = localStorage.getItem('sub_subscription_history');
        
        window.customers = c ? JSON.parse(c) : [];
        window.services = s ? JSON.parse(s) : [];
        window.expenses = e ? JSON.parse(e) : [];
        window.suppliers = sup ? JSON.parse(sup) : [];
        window.activityLog = act ? JSON.parse(act) : [];
        window.subscriptionHistory = subh ? JSON.parse(subh) : [];
    } catch (err) {
        console.error('❌ خطأ في تحميل البيانات:', err);
        window.customers = [];
        window.services = [];
        window.expenses = [];
        window.suppliers = [];
        window.activityLog = [];
        window.subscriptionHistory = [];
    }
}

// حمل البيانات فوراً
loadData(); // ← حمل هنا فوراً

let soundEnabled = localStorage.getItem('sub_sound') !== 'false';
let currentStartDate = new Date();
let currentEndDate = new Date();
let selectedStartDate = null;
let selectedEndDate = null;
let calendarOpen = { start: false, end: false };

// ===================== PUSH NOTIFICATION CONFIG =====================
let pushEnabled = localStorage.getItem('sub_push_enabled') === 'true';

// ===================== INIT =====================
document.addEventListener('DOMContentLoaded', function() {
    updateServicesSelect();
    updateSuppliersSelect();
    renderStock();
    updateStockSelect();
    checkServicesEmpty();
    renderAll();
    renderSuppliers();              // 👈 أضف السطر ده
    initCalendars();
    initExpenseCalendar();
    initPushNotifications();
    
    setTimeout(() => checkExpiringSubscriptions(), 2000);
    setInterval(() => checkExpiringSubscriptions(), 60000);
    
    scheduleDailyCheck();
    
    updateSoundIcon();
    updatePushIcon();
        // Init settings activation code inputs
    const settingsInputs = document.querySelectorAll('.settings-code-digit');
    settingsInputs.forEach((input, index) => {
        input.addEventListener('input', (e) => {
            const val = e.target.value;
            if (val.length === 1) {
                e.target.classList.add('filled');
                if (index < settingsInputs.length - 1) {
                    settingsInputs[index + 1].focus();
                }
            } else if (val.length === 0) {
                e.target.classList.remove('filled');
            }
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && !e.target.value && index > 0) {
                settingsInputs[index - 1].focus();
                settingsInputs[index - 1].classList.remove('filled');
            }
            if (e.key === 'Enter') {
                activateFromSettings();
            }
        });

        input.addEventListener('paste', (e) => {
            e.preventDefault();
            const pasteData = e.clipboardData.getData('text').trim().toUpperCase();
            if (pasteData.length === CODE_LENGTH) {
                settingsInputs.forEach((inp, i) => {
                    inp.value = pasteData[i] || '';
                    if (pasteData[i]) inp.classList.add('filled');
                });
                settingsInputs[settingsInputs.length - 1].focus();
            }
        });
    });
});

function checkServicesEmpty() {
    const msg = document.getElementById('noServicesMsg');
    if (!msg) return;
    
    if (services.length === 0) {
        msg.style.display = 'block';
    } else {
        msg.style.display = 'none';
    }
}
// ===================== PUSH NOTIFICATIONS =====================
function initPushNotifications() {
    if (!('Notification' in window)) {
        console.log('⚠️ المتصفح لا يدعم الإشعارات');
        return;
    }
    autoEnablePush();
}

// دالة جديدة: تفعيل تلقائي للإشعارات
async function autoEnablePush() {
    // لو مفعلة قبل كده، حدث الايقونة بس
    if (Notification.permission === 'granted') {
        pushEnabled = true;
        localStorage.setItem('sub_push_enabled', 'true');
        updatePushIcon();
        return;
    }

    // لو مرفوضة قبل كده، متسألش تاني (احترام للمستخدم)
    if (Notification.permission === 'denied') {
        console.log('🔕 الإشعارات مرفوضة من قبل');
        updatePushIcon();
        return;
    }

    // لو لسه ما اتسألناش (default)، نطلب الإذن بعد أول تفاعل
    if (Notification.permission === 'default') {
        console.log('🔔 الإشعارات لسه ما اتسألناش - هنستنى المستخدم يضغط الجرس');
        updatePushIcon();
    }
}

async function requestPushPermission() {
    console.log('🔔 requestPushPermission اتنادت');
    
    if (!('Notification' in window)) {
        showNotification('⚠️ متصفحك لا يدعم الإشعارات', 'warning');
        return false;
    }

    try {
        const permission = await Notification.requestPermission();
        console.log('📋 نتيجة الإذن:', permission);
        
        if (permission === 'granted') {
            pushEnabled = true;
            localStorage.setItem('sub_push_enabled', 'true');
            updatePushIcon();
            showNotification('✅ تم تفعيل الإشعارات بنجاح!', 'success');
            playSound('success');
            
            // إشعار ترحيبي
            setTimeout(() => {
                sendLocalNotification(
                    '🔔 الإشعارات مفعلة!',
                    'هتجيلك تنبيهات لما يجي معاد تجديد أي اشتراك.'
                );
            }, 1000);
            
            return true;
        } else {
            pushEnabled = false;
            localStorage.setItem('sub_push_enabled', 'false');
            updatePushIcon();
            showNotification('⚠️ تم رفض الإشعارات', 'warning');
            return false;
        }
    } catch (err) {
        console.error('❌ خطأ في طلب الإذن:', err);
        showNotification('⚠️ حصل خطأ في طلب الإذن', 'warning');
        return false;
    }
}

function togglePushNotifications() {
    console.log('🔔 togglePushNotifications اتنادت');
    
    if (!('Notification' in window)) {
        showNotification('⚠️ متصفحك لا يدعم الإشعارات', 'warning');
        return;
    }

    // لو الإشعارات مفعلة، إيقافها
    if (pushEnabled && Notification.permission === 'granted') {
        pushEnabled = false;
        localStorage.setItem('sub_push_enabled', 'false');
        updatePushIcon();
        showNotification('🔕 تم إيقاف الإشعارات', 'success');
        return;
    }

    // لو مش مفعلة، فعلها (اطلب الإذن)
    requestPushPermission();
}

function updatePushIcon() {
    const btn = document.getElementById('pushToggle');
    const icon = document.getElementById('pushIcon');
    
    if (!btn || !icon) {
        console.log('❌ pushToggle أو pushIcon مش موجودين في DOM');
        return;
    }
    
    console.log('🎨 updatePushIcon:', 'pushEnabled=' + pushEnabled, 'permission=' + Notification.permission);
    
    if (pushEnabled && Notification.permission === 'granted') {
        icon.className = 'fas fa-bell';
        btn.classList.remove('muted');
        btn.title = 'الإشعارات مفعلة - اضغط لإيقافها';
        btn.style.background = 'linear-gradient(135deg, var(--success), #059669)';
        btn.style.color = 'white';
        btn.style.borderColor = 'var(--success)';
    } else {
        icon.className = 'fas fa-bell-slash';
        btn.classList.add('muted');
        btn.title = 'تفعيل الإشعارات';
        btn.style.background = '';
        btn.style.color = '';
        btn.style.borderColor = '';
    }
}

function sendLocalNotification(title, body, options = {}) {
    console.log('📨 sendLocalNotification:', title);
    
    if (!pushEnabled || Notification.permission !== 'granted') {
        console.log('🔕 الإشعارات غير مفعلة - مش هنبعت');
        return;
    }

    const defaultOptions = {
        body: body,
        tag: options.tag || 'subscription-alert',
        requireInteraction: true,
        dir: 'rtl',
        lang: 'ar',
        vibrate: [200, 100, 200],
        ...options
    };

    try {
        new Notification(title, defaultOptions);
        console.log('✅ إشعار اتبعت');
    } catch (err) {
        console.error('❌ فشل إرسال الإشعار:', err);
    }
}

function testPushNotificationNow() {
    console.log('🧪 testPushNotificationNow اتنادت');
    
    // Test the new notification system with a sample
    showNotification(
        '🔔 ده إشعار تجريبي! اضغط ✅ أو اسحب للمسح',
        'success',
        { id: 'test_' + Date.now() }
    );
    
    // Also send a second one to test stacking
    setTimeout(() => {
        showNotification(
            '⏰ تنبيه: اشتراك أحمد ينتهي غداً! (تجريبي)',
            'warning',
            { id: 'test_expiring_' + Date.now(), repeat: true, customerId: 0 }
        );
    }, 500);
    
    playSound('success');
}

function scheduleDailyCheck() {
    const now = new Date();
    const targetTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 8, 0, 0);
    
    if (targetTime <= now) {
        targetTime.setDate(targetTime.getDate() + 1);
    }
    
    const msUntilTarget = targetTime - now;
    
    setTimeout(() => {
        checkExpiringSubscriptions();
        setInterval(() => checkExpiringSubscriptions(), 24 * 60 * 60 * 1000);
    }, msUntilTarget);
}

// ===================== NAVIGATION =====================
function showSection(sectionId) {
    // ✅ أقفل الموبايل مينو
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    if (sidebar) sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('show');
    
    // ✅ أخفي كل الأقسام
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    
    // ✅ أظهر القسم المطلوب
    const targetSection = document.getElementById(sectionId + '-section');
    if (targetSection) {
        targetSection.classList.add('active');
    }
    
    // ✅ فعل الـ nav-item المناسب
    document.querySelectorAll('.nav-item').forEach(item => {
        const onclick = item.getAttribute('onclick');
        if (onclick && onclick.includes("'" + sectionId + "'")) {
            item.classList.add('active');
        }
    });
    
    // ✅ لو خرجنا من قسم "إضافة عميل" من غير ما نكمل، نلغي وضع "إضافة اشتراك لعميل موجود"
    if (sectionId !== 'add-customer' && typeof unlockAddSubscriptionMode === 'function') unlockAddSubscriptionMode();

    // ✅ حدث البيانات حسب القسم + تصفير الفلاتر لما تدخل القسم
    if (sectionId === 'dashboard') renderDashboard();
    
    if (sectionId === 'customers') {
        // تصفير الفلاتر عشان يظهروا كلهم
        const searchInput = document.getElementById('customerSearch');
        const statusFilter = document.getElementById('statusFilter');
        if (searchInput) searchInput.value = '';
        if (statusFilter) statusFilter.value = 'all';
        renderCustomers();
    }
    
    if (sectionId === 'services') {
        console.log('🔄 تحديث قسم الخدمات...');
        renderServices();
    }
    
    if (sectionId === 'suppliers') {
        const sSearch = document.getElementById('supplierSearch');
        const sFilter = document.getElementById('supplierStatusFilter');
        if (sSearch) sSearch.value = '';
        if (sFilter) sFilter.value = 'all';
        renderSuppliers();
    }
    
    if (sectionId === 'stock') {
        const stSearch = document.getElementById('stockSearch');
        const stFilter = document.getElementById('stockStatusFilter');
        if (stSearch) stSearch.value = '';
        if (stFilter) stFilter.value = 'all';
        renderStock();
    }
    
    if (sectionId === 'expiring') renderExpiring();
    if (sectionId === 'finance') renderFinance();
    if (sectionId === 'activity-log') renderActivityLog();
    
    // ✅ حدث العدادات
    updateBadges();
}

function toggleMobileMenu() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    sidebar.classList.toggle('open');
    overlay.classList.toggle('show');
}

// ===================== CALENDAR =====================
function initCalendars() {
    renderCalendar('start', currentStartDate);
    renderCalendar('end', currentEndDate);
    
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.date-picker-container')) {
            closeAllCalendars();
        }
    });
}

function renderCalendar(type, date) {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();
    
    const monthNames = ['يناير', 'فبراير', 'مارس', 'إبريل', 'مايو', 'يونيو', 
                       'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
    
    document.getElementById(type + 'CalendarTitle').textContent = monthNames[month] + ' ' + year;
    
    const grid = document.getElementById(type + 'CalendarGrid');
    grid.innerHTML = '';
    
    // ✅ عرض أيام الأسبوع
    const dayHeaders = ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];
    dayHeaders.forEach(d => {
        const el = document.createElement('div');
        el.className = 'calendar-day-header';
        el.textContent = d;
        grid.appendChild(el);
    });
    
    // ✅ أيام الشهر السابق (فاضية)
    for (let i = 0; i < firstDay; i++) {
        const el = document.createElement('div');
        el.className = 'calendar-day other-month';
        el.textContent = daysInPrevMonth - firstDay + i + 1;
        grid.appendChild(el);
    }
    
    // ✅ أيام الشهر الحالي
    const today = new Date();
    for (let i = 1; i <= daysInMonth; i++) {
        const el = document.createElement('div');
        el.className = 'calendar-day';
        el.textContent = i;
        
        const thisDate = new Date(year, month, i);
        
        if (thisDate.toDateString() === today.toDateString()) {
            el.classList.add('today');
        }
        
        const selected = type === 'start' ? selectedStartDate : selectedEndDate;
        if (selected && thisDate.toDateString() === selected.toDateString()) {
            el.classList.add('selected');
        }
        
        el.onclick = () => selectDate(type, thisDate);
        grid.appendChild(el);
    }
    
    // ✅ أيام الشهر الجاي (فاضية)
    const totalCells = firstDay + daysInMonth;
    const remaining = (7 - (totalCells % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
        const el = document.createElement('div');
        el.className = 'calendar-day other-month';
        el.textContent = i;
        grid.appendChild(el);
    }
}

function changeMonth(type, delta) {
    if (type === 'start') {
        currentStartDate.setMonth(currentStartDate.getMonth() + delta);
        renderCalendar('start', currentStartDate);
    } else {
        currentEndDate.setMonth(currentEndDate.getMonth() + delta);
        renderCalendar('end', currentEndDate);
    }
}

function toggleCalendar(type) {
    const other = type === 'start' ? 'end' : 'start';
    document.getElementById(other + 'Calendar').classList.remove('show');
    calendarOpen[other] = false;
    
    const cal = document.getElementById(type + 'Calendar');
    calendarOpen[type] = !calendarOpen[type];
    cal.classList.toggle('show', calendarOpen[type]);
}

function closeAllCalendars() {
    document.getElementById('startCalendar').classList.remove('show');
    document.getElementById('endCalendar').classList.remove('show');
    calendarOpen.start = false;
    calendarOpen.end = false;
}

function selectDate(type, date) {
    if (type === 'start') {
        selectedStartDate = date;
        document.getElementById('startDate').value = formatDate(date);
        document.getElementById('startDateText').textContent = formatDateArabic(date);
    } else {
        selectedEndDate = date;
        document.getElementById('endDate').value = formatDate(date);
        document.getElementById('endDateText').textContent = formatDateArabic(date);
    }
    renderCalendar(type, type === 'start' ? currentStartDate : currentEndDate);
    closeAllCalendars();
}

function formatDate(date) {
    return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
}

function formatDateArabic(date) {
    const months = ['يناير', 'فبراير', 'مارس', 'إبريل', 'مايو', 'يونيو', 
                   'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
    return date.getDate() + ' ' + months[date.getMonth()] + ' ' + date.getFullYear();
}

// ===================== CUSTOMERS =====================
async function addCustomer(e) {
    e.preventDefault();

    const name = document.getElementById('customerName').value.trim();
    const source = document.getElementById('customerSource').value;
    const serviceId = parseInt(document.getElementById('customerService').value);
    const supplierId = document.getElementById('customerSupplier').value;
    const costPrice = parseFloat(document.getElementById('customerCostPrice').value) || 0;
    const sellPrice = parseFloat(document.getElementById('customerSellPrice').value) || 0;
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    const notes = document.getElementById('customerNotes').value.trim();
    const phone = document.getElementById('customerPhone').value.trim();
    const stockId = document.getElementById('customerStockItem').value;
    const whatsappPaid = document.getElementById('customerWhatsAppPaid')?.checked === true;
    const lockedGroupIdField = document.getElementById('customerGroupId');
    const lockedGroupId = lockedGroupIdField ? lockedGroupIdField.value : '';

    if (services.length === 0) {
        showNotification('⚠️ مفيش خدمات! ضيف خدمة الأول من قسم الخدمات', 'warning');
        return;
    }

    if (!name || !source || !serviceId || !startDate || !endDate) {
        showNotification('⚠️ يرجى ملء جميع الحقول المطلوبة', 'warning');
        return;
    }

    if (whatsappPaid && !phone) {
        showNotification('⚠️ علشان نستهلك تحويل واتساب لازم تدخل رقم العميل.', 'warning');
        return;
    }

    const service = services.find(s => s.id === serviceId);
    const supplier = suppliers.find(s => s.id == supplierId);
    let stockItem = null;

    // ===== Unified Customer Profile: detect existing customer by locked group id or by name =====
    let groupId = lockedGroupId || findGroupIdByName(name);
    const isMerge = !!groupId;
    if (!groupId) groupId = generateGroupId();

    const customer = {
        id: Date.now() + Math.floor(Math.random() * 100000),
        customerId: groupId,
        name,
        source,
        serviceId,
        serviceName: service.name,
        serviceIcon: service.icon,
        price: sellPrice || service.price,
        costPrice,
        sellPrice: sellPrice || service.price,
        supplierId: supplierId || null,
        supplierName: supplier ? supplier.name : null,
        startDate,
        endDate,
        notes,
        phone: phone || null,
        stockId: null,
        deliveredEmail: null,
        deliveredPassword: null,
        status: 'active',
        renewCount: 0,
        addedAt: new Date().toISOString(),
        subscriptionHistory: [{
            serviceId, serviceName: service.name, serviceIcon: service.icon, startDate, endDate,
            costPrice, sellPrice: sellPrice || service.price, supplierId: supplierId || null, status: 'active', isRenewal: false,
            createdAt: new Date().toISOString()
        }]
    };

    // Handle stock selection - decrease remaining uses
    if (stockId) {
        stockItem = stock.find(s => s.id == stockId);
        if (!stockItem) { showNotification('الحساب مش موجود', 'warning'); return; }
        if (stockItem.remainingUses <= 0) { showNotification('الحساب ' + stockItem.email + ' خلص! اختار حساب تاني', 'warning'); return; }
        stockItem.remainingUses -= 1;
        customer.stockId = stockItem.id;
        customer.deliveredEmail = stockItem.email;
        customer.deliveredPassword = stockItem.password;

        // ✅ أضف مصروف الشراء تلقائياً
        const purchaseExpense = {
            id: Date.now() + Math.random(),
            serviceId: serviceId,
            serviceName: service.name,
            serviceIcon: service.icon,
            desc: `شراء من المورد - ${supplier ? supplier.name : 'غير محدد'} (${name})`,
            amount: costPrice,
            date: startDate || formatDate(new Date()),
            notes: `مصروف شراء تلقائي - عميل: ${name}`,
            customerId: customer.id,
            isAutoPurchase: true
        };
        expenses.push(purchaseExpense);
        saveExpenses();
        saveData();
    }

    customers.push(customer);
    logActivity(isMerge ? 'subscription_create' : 'customer_create', {
        customerName: name, customerId: groupId, serviceName: service.name,
        details: isMerge ? `إضافة اشتراك جديد (${service.name}) لعميل موجود: ${name}` : `إضافة عميل جديد: ${name}`
    });
    saveData();

    let paymentNotice = '';
    if (whatsappPaid) {
        showNotification('⏳ تم تسجيل العميل. جاري تعليم تحويل واتساب كمستخدم...', 'success');
        const paymentResult = await markWhatsAppPaymentUsed(phone, sellPrice || service.price);
        if (paymentResult && paymentResult.success) {
            paymentNotice = ' وتم تعليم تحويل واتساب كمستخدم';
        } else {
            paymentNotice = ' لكن لم يتم تعليم تحويل واتساب: ' + ((paymentResult && paymentResult.message) || 'تحويل غير مطابق');
        }
    }

    showNotification(
        (isMerge ? '✅ تم إضافة اشتراك جديد للعميل ' : '✅ تم إضافة العميل ') + name + ' بنجاح!' + (stockItem ? ' (حساب: ' + stockItem.email + ')' : '') + paymentNotice,
        paymentNotice.includes('لكن لم يتم') ? 'warning' : 'success'
    );
    playSound('success');

    resetForm();
    renderAll();
}

function resetForm() {
    document.getElementById('customerForm').reset();
    selectedStartDate = null;
    selectedEndDate = null;
    document.getElementById('startDateText').textContent = 'اختر التاريخ';
    document.getElementById('endDateText').textContent = 'اختر التاريخ';
    document.getElementById('startDate').value = '';
    document.getElementById('endDate').value = '';
    document.getElementById('customerPrice').value = '';
    document.getElementById('customerPhone').value = '';
    document.getElementById('customerMessengerLink').value = '';
    document.getElementById('readyMessage').value = '';
    document.getElementById('customerStockItem').value = '';
    const whatsappPaidInput = document.getElementById('customerWhatsAppPaid');
    if (whatsappPaidInput) whatsappPaidInput.checked = false;
    const preview = document.getElementById('stockPreview');
    if (preview) preview.style.display = 'none';
    updateStockSelect();
    currentStartDate = new Date();
    currentEndDate = new Date();
    renderCalendar('start', currentStartDate);
    renderCalendar('end', currentEndDate);
    unlockAddSubscriptionMode();
}

// ===================== ADD-SUBSCRIPTION MODE (Feature 3b) =====================
// يفعّل نفس نموذج "إضافة عميل" لكن مقفول على اسم عميل موجود، فيتضاف الاشتراك الجديد لملفه مباشرة
function startAddSubscriptionFor(groupId) {
    const info = getGroupInfo(groupId);
    if (!info) return;
    closeCustomerProfileModal();
    showSection('add-customer');
    const nameInput = document.getElementById('customerName');
    nameInput.value = info.name;
    nameInput.readOnly = true;
    nameInput.style.opacity = '0.75';
    if (info.phone) {
        const phoneInput = document.getElementById('customerPhone');
        if (phoneInput) phoneInput.value = info.phone;
    }
    let hidden = document.getElementById('customerGroupId');
    if (!hidden) {
        hidden = document.createElement('input');
        hidden.type = 'hidden';
        hidden.id = 'customerGroupId';
        document.getElementById('customerForm').appendChild(hidden);
    }
    hidden.value = groupId;

    let banner = document.getElementById('addSubscriptionBanner');
    if (!banner) {
        banner = document.createElement('div');
        banner.id = 'addSubscriptionBanner';
        banner.style.cssText = 'margin-bottom:18px;padding:14px 18px;background:rgba(16,185,129,0.1);border:1px solid var(--success);border-radius:14px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;';
        const form = document.getElementById('customerForm');
        form.parentNode.insertBefore(banner, form);
    }
    banner.innerHTML = `
        <span style="font-weight:700;color:var(--success);"><i class="fas fa-user-check"></i> بتضيف اشتراك جديد للعميل: ${info.name}</span>
        <button type="button" class="btn btn-outline" style="font-size:12px;" onclick="unlockAddSubscriptionMode()">إلغاء والإضافة كعميل جديد</button>
    `;
    banner.style.display = 'flex';
}

function unlockAddSubscriptionMode() {
    const nameInput = document.getElementById('customerName');
    if (nameInput) { nameInput.readOnly = false; nameInput.style.opacity = ''; }
    const hidden = document.getElementById('customerGroupId');
    if (hidden) hidden.value = '';
    const banner = document.getElementById('addSubscriptionBanner');
    if (banner) banner.style.display = 'none';
}

function updatePrice() {
    const serviceId = parseInt(document.getElementById('customerService').value);
    const service = services.find(s => s.id === serviceId);
    if (service) {
        document.getElementById('customerPrice').value = service.price + ' ج.م';
    }
}

function deleteCustomer(id) {
    const numId = Number(id);
    const customer = customers.find(c => c.id === numId);
    if (!customer) return;
    if (confirm('هل أنت متأكد من حذف اشتراك "' + customer.serviceName + '" الخاص بـ ' + customer.name + '؟')) {
        // ✅ امسح المصروف المرتبطة بالعميل
        expenses = expenses.filter(e => e.customerId !== numId);
        saveExpenses();

        customers = customers.filter(c => c.id !== numId);
        logActivity('subscription_delete', { customerName: customer.name, customerId: customer.customerId, serviceName: customer.serviceName, details: `حذف اشتراك ${customer.serviceName} لـ ${customer.name}` });
        saveData();
        renderAll();
        closeCustomerProfileModal();
        showNotification('🗑️ تم حذف الاشتراك والمصروف المرتبط', 'success');
    }
}

// حذف كل ملف العميل (كل الاشتراكات المرتبطة بنفس الاسم الموحّد)
function deleteCustomerGroup(groupId) {
    const subs = getGroupSubscriptions(groupId);
    if (subs.length === 0) return;
    const name = subs[0].name;
    const msg = subs.length > 1
        ? `هل أنت متأكد من حذف ملف العميل "${name}" بالكامل؟ (سيتم حذف ${subs.length} اشتراكات)`
        : `هل أنت متأكد من حذف العميل "${name}"؟`;
    if (!confirm(msg)) return;

    const ids = subs.map(s => s.id);
    expenses = expenses.filter(e => !ids.includes(e.customerId));
    saveExpenses();

    customers = customers.filter(c => c.customerId !== groupId);
    logActivity('customer_delete', { customerName: name, customerId: groupId, details: `حذف ملف العميل ${name} بالكامل (${subs.length} اشتراك)` });
    saveData();
    renderAll();
    closeCustomerProfileModal();
    showNotification('🗑️ تم حذف ملف العميل بالكامل', 'success');
}

// زر التجديد السريع: بيفتح نافذة اختيار الاشتراك والمدة (Feature 4 + 5)
function renewCustomer(id) {
    const customer = customers.find(c => c.id === Number(id));
    if (!customer) return;
    openRenewalModal(customer.customerId, customer.id);
}

function getStatus(customer) {
    const end = new Date(customer.endDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    
    const diffTime = end.getTime() - today.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    
    if (customer.status === 'completed') return { status: 'completed', text: 'مكتمل', class: 'status-completed' };
    if (diffDays < 0) return { status: 'expired', text: 'منتهي', class: 'status-expired' };
    if (diffDays === 0) return { status: 'expiring', text: 'ينتهي اليوم', class: 'status-expiring' };
    if (diffDays === 1) return { status: 'expiring', text: 'ينتهي غداً', class: 'status-expiring' };
    return { status: 'active', text: 'نشط (' + diffDays + ' يوم)', class: 'status-active' };
}

function getSourceIcon(source) {
    const icons = {
        whatsapp: '<i class="fab fa-whatsapp" style="color: #25d366;"></i>',
        messenger: '<i class="fab fa-facebook-messenger" style="color: #0084ff;"></i>',
        telegram: '<i class="fab fa-telegram" style="color: #0088cc;"></i>',
        instagram: '<i class="fab fa-instagram" style="color: #e4405f;"></i>',
        facebook: '<i class="fab fa-facebook" style="color: #1877f2;"></i>',
        direct: '<i class="fas fa-handshake" style="color: var(--success);"></i>',
        other: '<i class="fas fa-ellipsis-h" style="color: var(--gray);"></i>'
    };
    return icons[source] || icons.other;
}

function getSourceName(source) {
    const names = {
        whatsapp: 'واتساب',
        messenger: 'مسنجر',
        telegram: 'تيليجرام',
        instagram: 'انستجرام',
        facebook: 'فيسبوك',
        direct: 'مباشر',
        other: 'أخرى'
    };
    return names[source] || source;
}

// ===================== UNIFIED CUSTOMER PROFILE (GROUPING) =====================
// نفس اسم العميل = نفس الملف الموحّد. كل اشتراكاته بتترابط بـ customerId واحد
// بدون ما نلمس شكل تخزين كل اشتراك، عشان التوافق الكامل مع البيانات القديمة.
function normalizeCustomerName(name) {
    return (name || '').toString().trim().replace(/\s+/g, ' ').toLowerCase();
}

function generateGroupId() {
    return 'grp_' + Date.now() + '_' + Math.floor(Math.random() * 1000000);
}

function findGroupIdByName(name) {
    const norm = normalizeCustomerName(name);
    if (!norm) return null;
    const existing = customers.find(c => normalizeCustomerName(c.name) === norm);
    return existing ? existing.customerId : null;
}

function getGroupSubscriptions(groupId) {
    return customers.filter(c => c.customerId === groupId);
}

function getGroupInfo(groupId) {
    const subs = getGroupSubscriptions(groupId);
    if (subs.length === 0) return null;
    const byRecent = [...subs].sort((a, b) => new Date(b.addedAt || 0) - new Date(a.addedAt || 0));
    const phone = byRecent.find(s => s.phone)?.phone || null;
    return { groupId, name: byRecent[0].name, phone, source: byRecent[0].source, subs };
}

// يجمع أي قائمة اشتراكات (فلترة/بحث) في ملفات عملاء موحّدة للعرض
function groupCustomerList(list) {
    const map = new Map();
    list.forEach(c => {
        if (!c.customerId) c.customerId = findGroupIdByName(c.name) || generateGroupId();
        if (!map.has(c.customerId)) map.set(c.customerId, []);
        map.get(c.customerId).push(c);
    });
    const groups = [];
    map.forEach((subs, groupId) => {
        const sortedSubs = sortCustomersByPriority(subs);
        const byRecent = [...subs].sort((a, b) => new Date(b.addedAt || 0) - new Date(a.addedAt || 0));
        groups.push({
            groupId,
            name: byRecent[0].name,
            phone: byRecent.find(s => s.phone)?.phone || null,
            source: byRecent[0].source,
            subs: sortedSubs,
            primary: sortedSubs[0],
            count: subs.length,
            needsRenewal: subs.some(s => ['expired', 'expiring'].includes(getStatus(s).status))
        });
    });
    return groups;
}

function sortGroupsByPriority(groups) {
    // الترتيب المطلوب: هينتهي (النهاردة/بكرة) فوق خالص -> نشط (الأحدث أولاً) -> مكتمل -> منتهي تحت خالص
    const p = { expiring: 0, active: 1, completed: 2, expired: 3 };
    return [...groups].sort((a, b) => {
        const sa = getStatus(a.primary).status, sb = getStatus(b.primary).status;
        const d = (p[sa] ?? 4) - (p[sb] ?? 4);
        if (d !== 0) return d;

        // داخل "هينتهي": الي هينتهي النهاردة فوق الي هينتهي بكرة
        if (sa === 'expiring') {
            return new Date(a.primary.endDate) - new Date(b.primary.endDate);
        }
        // داخل "نشط": الأحدث إضافة فوق (من الأحدث للأقدم)
        if (sa === 'active') {
            return new Date(b.primary.addedAt || 0) - new Date(a.primary.addedAt || 0);
        }
        // داخل "منتهي/مكتمل": الأحدث انتهاءً فوق داخل نفس التصنيف
        return new Date(b.primary.endDate) - new Date(a.primary.endDate);
    });
}

// ===================== FULL EDITING (Feature 2) =====================
function openEditProfileModal(groupId) {
    const info = getGroupInfo(groupId);
    if (!info) return;
    document.getElementById('editProfileGroupId').value = groupId;
    document.getElementById('editProfileName').value = info.name;
    document.getElementById('editProfilePhone').value = info.phone || '';
    document.getElementById('editProfileSource').value = info.source || 'whatsapp';
    document.getElementById('editProfileModal').classList.add('show');
}
function closeEditProfileModal() { document.getElementById('editProfileModal').classList.remove('show'); }

function saveEditProfile(e) {
    e.preventDefault();
    const groupId = document.getElementById('editProfileGroupId').value;
    const newName = document.getElementById('editProfileName').value.trim();
    const newPhone = document.getElementById('editProfilePhone').value.trim();
    const newSource = document.getElementById('editProfileSource').value;
    if (!newName) { showNotification('⚠️ أدخل اسم العميل', 'warning'); return; }

    const subs = getGroupSubscriptions(groupId);
    if (subs.length === 0) return;
    const oldName = subs[0].name;
    subs.forEach(s => {
        s.name = newName;
        s.phone = newPhone || null;
        s.source = newSource;
    });
    logActivity('customer_edit', { customerName: newName, customerId: groupId, details: `تعديل بيانات العميل ${oldName}${oldName !== newName ? ' -> ' + newName : ''}` });
    saveData();
    renderAll();
    closeEditProfileModal();
    showCustomerProfile(groupId);
    showNotification('✅ تم تحديث بيانات العميل', 'success');
    playSound('success');
}

function openEditSubscriptionModal(subId) {
    const sub = customers.find(c => c.id === Number(subId));
    if (!sub) return;
    document.getElementById('editSubId').value = sub.id;
    const serviceSel = document.getElementById('editSubService');
    serviceSel.innerHTML = services.map(s => `<option value="${s.id}">${s.icon} ${s.name}</option>`).join('');
    serviceSel.value = sub.serviceId;
    const supplierSel = document.getElementById('editSubSupplier');
    supplierSel.innerHTML = '<option value="">بدون مورد</option>' + suppliers.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
    supplierSel.value = sub.supplierId || '';
    document.getElementById('editSubCostPrice').value = sub.costPrice || 0;
    document.getElementById('editSubSellPrice').value = sub.sellPrice || sub.price || 0;
    document.getElementById('editSubStartDate').value = sub.startDate;
    document.getElementById('editSubEndDate').value = sub.endDate;
    document.getElementById('editSubNotes').value = sub.notes || '';
    document.getElementById('editSubscriptionModal').classList.add('show');
}
function closeEditSubscriptionModal() { document.getElementById('editSubscriptionModal').classList.remove('show'); }

function saveEditSubscription(e) {
    e.preventDefault();
    const id = Number(document.getElementById('editSubId').value);
    const sub = customers.find(c => c.id === id);
    if (!sub) return;

    const serviceId = parseInt(document.getElementById('editSubService').value);
    const service = services.find(s => s.id === serviceId);
    const supplierId = document.getElementById('editSubSupplier').value;
    const supplier = suppliers.find(s => s.id == supplierId);
    const startDate = document.getElementById('editSubStartDate').value;
    const endDate = document.getElementById('editSubEndDate').value;
    if (!service || !startDate || !endDate) { showNotification('⚠️ يرجى ملء جميع الحقول المطلوبة', 'warning'); return; }

    sub.serviceId = serviceId;
    sub.serviceName = service.name;
    sub.serviceIcon = service.icon;
    sub.supplierId = supplierId || null;
    sub.supplierName = supplier ? supplier.name : null;
    sub.costPrice = parseFloat(document.getElementById('editSubCostPrice').value) || 0;
    sub.sellPrice = parseFloat(document.getElementById('editSubSellPrice').value) || 0;
    sub.price = sub.sellPrice;
    sub.startDate = startDate;
    sub.endDate = endDate;
    sub.notes = document.getElementById('editSubNotes').value.trim();

    logActivity('subscription_edit', { customerName: sub.name, customerId: sub.customerId, serviceName: service.name, details: `تعديل اشتراك ${service.name} لـ ${sub.name}` });
    saveData();
    renderAll();
    closeEditSubscriptionModal();
    showCustomerProfile(sub.customerId);
    showNotification('✅ تم حفظ تعديلات الاشتراك', 'success');
    playSound('success');
}

function deleteSubscription(subId) {
    const sub = customers.find(c => c.id === Number(subId));
    if (!sub) return;
    deleteCustomer(sub.id);
}

// ===================== RENEWAL (Feature 4 + 5) =====================
function openRenewalModal(groupId, preselectSubId) {
    const subs = getGroupSubscriptions(groupId);
    if (subs.length === 0) return;
    document.getElementById('renewalGroupId').value = groupId;

    const sel = document.getElementById('renewalSubSelect');
    const sortedSubs = sortCustomersByPriority(subs);
    const defaultSub = preselectSubId ? subs.find(s => s.id === Number(preselectSubId)) : sortedSubs.find(s => ['expired', 'expiring'].includes(getStatus(s).status)) || sortedSubs[0];
    sel.innerHTML = sortedSubs.map(s => {
        const st = getStatus(s);
        return `<option value="${s.id}" ${defaultSub && s.id === defaultSub.id ? 'selected' : ''}>${s.serviceIcon} ${s.serviceName} - ${st.text} (حتى ${formatDateArabic(new Date(s.endDate))})</option>`;
    }).join('');

    document.getElementById('renewalDuration').value = '30';
    document.getElementById('renewalCustomDays').value = '';
    document.getElementById('renewalCustomDays').style.display = 'none';
    document.getElementById('renewalModal').classList.add('show');
}
function closeRenewalModal() { document.getElementById('renewalModal').classList.remove('show'); }

function toggleRenewalCustomDays() {
    const val = document.getElementById('renewalDuration').value;
    document.getElementById('renewalCustomDays').style.display = val === 'custom' ? 'block' : 'none';
}

function confirmRenewal(e) {
    e.preventDefault();
    const groupId = document.getElementById('renewalGroupId').value;
    const subId = Number(document.getElementById('renewalSubSelect').value);
    const sub = customers.find(c => c.id === subId);
    if (!sub) return;

    const durationVal = document.getElementById('renewalDuration').value;
    let days = parseInt(durationVal);
    if (durationVal === 'custom') {
        days = parseInt(document.getElementById('renewalCustomDays').value);
        if (!days || days <= 0) { showNotification('⚠️ أدخل عدد أيام صحيح', 'warning'); return; }
    }

    // نبدأ التجديد من النهاردة، أو من تاريخ انتهاء الاشتراك القديم لو لسه ماخلصش
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const oldEnd = new Date(sub.endDate); oldEnd.setHours(0, 0, 0, 0);
    const newStart = oldEnd > today ? oldEnd : today;
    const newEnd = new Date(newStart);
    newEnd.setDate(newEnd.getDate() + days);

    // احفظ نسخة من الدورة القديمة في سجل الاشتراك الخاص بيه
    if (!Array.isArray(sub.subscriptionHistory)) sub.subscriptionHistory = [];
    sub.subscriptionHistory.push({
        serviceId: sub.serviceId, serviceName: sub.serviceName, serviceIcon: sub.serviceIcon,
        startDate: sub.startDate, endDate: sub.endDate, costPrice: sub.costPrice, sellPrice: sub.sellPrice,
        supplierId: sub.supplierId, status: 'completed', isRenewal: false, createdAt: sub.addedAt || new Date().toISOString()
    });

    sub.startDate = formatDate(newStart);
    sub.endDate = formatDate(newEnd);
    sub.status = 'active';
    sub.renewedAt = new Date().toISOString();
    sub.renewCount = (sub.renewCount || 0) + 1;

    logActivity('subscription_renew', { customerName: sub.name, customerId: groupId, serviceName: sub.serviceName, details: `تجديد اشتراك ${sub.serviceName} لـ ${sub.name} (${days} يوم)` });
    saveData();
    renderAll();
    closeRenewalModal();
    if (document.getElementById('customerProfileModal').classList.contains('show')) showCustomerProfile(groupId);
    showNotification('🔄 تم تجديد اشتراك ' + sub.name + ' (' + sub.serviceName + ') لمدة ' + days + ' يوم', 'success');
    playSound('success');
}

// ===================== SERVICES =====================
function openServiceModal() {
    document.getElementById('serviceModal').classList.add('show');
}

function closeServiceModal() {
    document.getElementById('serviceModal').classList.remove('show');
    document.getElementById('serviceName').value = '';
    document.getElementById('servicePrice').value = '';
}

function addService(e) {
    e.preventDefault();
    
    const name = document.getElementById('serviceName').value.trim();
    const price = parseFloat(document.getElementById('servicePrice').value);
    const icon = document.getElementById('serviceIcon').value;
    
    if (!name || !price) {
        showNotification('⚠️ أدخل اسم الخدمة والسعر', 'warning');
        return;
    }
    
    const service = {
        id: Date.now(),
        name: name,
        price: price,
        icon: icon,
        customers: 0
    };
    
    // ✅ أضف للمصفوفة
    services.push(service);
    
    // ✅ احفظ في localStorage
    saveData();
    
    // ✅ حدث dropdown في نموذج العميل
    updateServicesSelect();
    
    // ✅ شيك لو مفيش خدمات (نخفي الرسالة)
    checkServicesEmpty();
    
    // ✅ حدث صفحة الخدمات فوراً
    renderServices();
    
    // ✅ حدث كل الصفحات التانية
    renderAll();
    
    // ✅ أقفل المودال
    closeServiceModal();
    
    // ✅ إشعار نجاح
    showNotification('✅ تم إضافة الخدمة ' + name + ' بنجاح!', 'success');
    playSound('success');
    
    console.log('✅ خدمة جديدة:', service, 'الإجمالي:', services.length);
}

function deleteService(id) {
    if (confirm('هل أنت متأكد من حذف هذه الخدمة؟')) {
        services = services.filter(s => s.id !== id);
        saveData();
        
        // ✅ حدث dropdown في نموذج العميل
        updateServicesSelect();
        
        // ✅ شيك لو مفيش خدمات
        checkServicesEmpty();
        
        // ✅ حدث صفحة الخدمات فوراً
        renderServices();
        
        // ✅ حدث كل الصفحات
        renderAll();
        
        showNotification('🗑️ تم حذف الخدمة', 'success');
        
        console.log('🗑️ خدمة محذوفة. المتبقي:', services.length);
    }
}

function updateServicesSelect() {
    const select = document.getElementById('customerService');
    select.innerHTML = '';
    
    if (services.length === 0) {
        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = '⚠️ مفيش خدمات - ضيف خدمة الأول من قسم الخدمات';
        select.appendChild(opt);
        return;
    }
    
    const defaultOpt = document.createElement('option');
    defaultOpt.value = '';
    defaultOpt.textContent = 'اختر الخدمة';
    select.appendChild(defaultOpt);
    
    services.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.id;
        opt.textContent = s.icon + ' ' + s.name + ' - ' + s.price + ' ج.م';
        select.appendChild(opt);
    });
}

// ===================== RENDERING =====================
function renderAll() {
    renderDashboard();
    renderCustomers();
    renderServices();
    renderSuppliers();          // 👈 أضف السطر ده
    renderExpiring();
    renderFinance();
    updateBadges();
    updateServicesSelect();
    updateSuppliersSelect();
    renderStock();
    updateStockSelect();
    checkServicesEmpty();
}

function renderDashboard() {
    startTrialWidget();
    document.getElementById('totalCustomers').textContent = customers.length;
    
    const active = customers.filter(c => getStatus(c).status === 'active').length;
    document.getElementById('activeSubscriptions').textContent = active;
    
    const expiring = customers.filter(c => getStatus(c).status === 'expiring').length;
    document.getElementById('expiringSoon').textContent = expiring;
    
    const revenue = customers.reduce((sum, c) => sum + (c.price || 0), 0);
    document.getElementById('totalRevenue').textContent = revenue.toLocaleString() + ' ج.م';
    
    const sortedCustomers = [...customers].sort((a, b) => {
        const statusA = getStatus(a).status;
        const statusB = getStatus(b).status;
        const priority = { active: 0, expiring: 1, expired: 2, completed: 3 };
        const diff = (priority[statusA] || 0) - (priority[statusB] || 0);
        if (diff !== 0) return diff;
        return new Date(a.endDate) - new Date(b.endDate);
    });
    
    const container = document.getElementById('recentCustomers');
    
    if (sortedCustomers.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">👥</div>
                <div class="empty-state-title">لا يوجد عملاء بعد</div>
                <div class="empty-state-text">ابدأ بإضافة عميل جديد</div>
                <button class="btn btn-primary" onclick="showSection('add-customer')">
                    <i class="fas fa-plus"></i> إضافة عميل
                </button>
            </div>`;
        return;
    }
    
    // ===== DESKTOP TABLE =====
    const tableHTML = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>العميل</th>
                    <th>بيانات التواصل</th>
                    <th>الخدمة</th>
                    <th>تاريخ الانتهاء</th>
                    <th>الحالة</th>
                    <th>الإجراءات</th>
                </tr>
            </thead>
            <tbody>
                ${sortedCustomers.map(c => {
                    const st = getStatus(c);
                    const end = new Date(c.endDate);
                    end.setHours(0,0,0,0);
                    const today = new Date();
                    today.setHours(0,0,0,0);
                    const daysLeft = Math.round((end - today) / (1000*60*60*24));
                    const isRenewed = c.renewedAt && c.addedAt && new Date(c.renewedAt) > new Date(c.addedAt);
                    
                    return `
                    <tr style="${st.status === 'completed' || st.status === 'expired' ? 'opacity: 0.6; background: rgba(239,68,68,0.05);' : ''}">
                        <td>
                            <div class="customer-info">
                                <div class="customer-avatar" style="${isRenewed ? 'background: linear-gradient(135deg, var(--success), #059669);' : ''}">
                                    ${isRenewed ? '<i class="fas fa-sync-alt"></i>' : c.name.charAt(0)}
                                </div>
                                <div>
                                    <div class="customer-name">
                                        ${c.name} 
                                        ${isRenewed ? '<span style="color: var(--success); font-size: 11px; margin-right: 5px;"><i class="fas fa-redo"></i> تم التجديد</span>' : ''}
                                    </div>
                                    <div class="customer-source">${getSourceIcon(c.source)} ${getSourceName(c.source)}</div>
                                </div>
                            </div>
                            </td>
                            <td>
                                <span class="service-tag">${c.serviceIcon} ${c.serviceName}</span>
                                ${c.deliveredEmail ? `<div style="font-size:12px;color:var(--primary);margin-top:4px;"><i class="fas fa-envelope" style="margin-left:4px;"></i>${c.deliveredEmail}</div>` : ''}
                                ${c.deliveredPassword ? `<div style="font-size:12px;color:var(--warning);margin-top:2px;"><i class="fas fa-key" style="margin-left:4px;"></i>${c.deliveredPassword}</div>` : ''}
                            </td>     
                            <td>
                            ${formatDateArabic(new Date(c.endDate))}
                            ${daysLeft > 0 && st.status !== 'completed' ? '<br><span style="color: var(--gray); font-size: 12px;">(' + daysLeft + ' ' + (daysLeft === 1 ? 'يوم متبقي' : 'أيام متبقية') + ')</span>' : ''}
                            ${daysLeft === 0 && st.status !== 'completed' ? '<br><span style="color: var(--warning); font-size: 12px;">(ينتهي اليوم)</span>' : ''}
                            ${daysLeft < 0 ? '<br><span style="color: var(--danger); font-size: 12px;">(انتهى من ' + Math.abs(daysLeft) + ' ' + (Math.abs(daysLeft) === 1 ? 'يوم' : 'أيام') + ')</span>' : ''}
                        </td>
                        <td><span class="status-badge ${st.class}">${st.text}</span></td>
                        <td>
                            <div class="action-btns">
                                ${st.status !== 'completed' && st.status !== 'expired' ? `<button class="action-btn renew" onclick="renewCustomer(${c.id})" title="تجديد الاشتراك"><i class="fas fa-sync-alt"></i></button>` : `<button class="action-btn renew" onclick="renewCustomer(${c.id})" title="تجديد من جديد" style="background: rgba(16,185,129,0.3);"><i class="fas fa-redo"></i></button>`}
                                <button class="action-btn delete" onclick="deleteCustomer(${c.id})" title="حذف العميل"><i class="fas fa-trash"></i></button>
                            </div>
                        </td>
                    </tr>`;
                }).join('')}
            </tbody>
        </table>`;
    
    // ===== MOBILE COLLAPSIBLE CARDS =====
    const cardsHTML = `
        <div class="customers-mobile-cards">
            ${sortedCustomers.slice(0, 10).map(c => {
                const st = getStatus(c);
                const end = new Date(c.endDate);
                end.setHours(0,0,0,0);
                const today = new Date();
                today.setHours(0,0,0,0);
                const daysLeft = Math.round((end - today) / (1000*60*60*24));
                const isRenewed = c.renewedAt && c.addedAt && new Date(c.renewedAt) > new Date(c.addedAt);
                
                let daysClass = 'active';
                let daysText = '';
                if (daysLeft > 0) {
                    daysText = daysLeft + ' ' + (daysLeft === 1 ? 'يوم متبقي' : 'أيام متبقية');
                    daysClass = 'active';
                } else if (daysLeft === 0) {
                    daysText = 'ينتهي اليوم!';
                    daysClass = 'expiring';
                } else {
                    daysText = 'انتهى من ' + Math.abs(daysLeft) + ' ' + (Math.abs(daysLeft) === 1 ? 'يوم' : 'أيام');
                    daysClass = 'expired';
                }
                
                return `
                <div class="customer-mobile-card status-${st.status}" onclick="toggleCard(this, event)" data-customer-id="${c.id}">
                    
                    <!-- COLLAPSED HEADER -->
                    <div class="customer-card-header">
                        <div class="customer-card-avatar ${isRenewed ? 'renewed' : ''}">
                            ${isRenewed ? '<i class="fas fa-redo"></i>' : c.name.charAt(0)}
                        </div>
                        <div class="customer-card-info">
                            <div class="customer-card-name">
                                ${c.name}
                                ${isRenewed ? '<span class="renew-badge"><i class="fas fa-redo"></i> تم التجديد</span>' : ''}
                            </div>
                            <div class="customer-card-service">
                                <span class="service-icon">${c.serviceIcon}</span>
                                ${c.serviceName}
                            </div>
                        </div>
                        <div class="customer-card-meta">
                            <div class="customer-card-price">${c.price || 0} ج.م</div>
                            <div class="customer-card-status-compact status-${st.status}">
                                <i class="fas fa-circle" style="font-size: 6px;"></i>
                                ${st.text.split(' ')[0]}
                            </div>
                        </div>
                    </div>
                    
                    <div class="customer-card-expand">
                        <i class="fas fa-chevron-down"></i>
                    </div>
                    
                    <!-- EXPANDABLE BODY -->
                    <div class="customer-card-body" onclick="event.stopPropagation()">
                        <div class="customer-card-field">
                            <div class="customer-card-label">الحالة</div>
                            <div class="customer-card-value days-left ${daysClass}">${daysText}</div>
                        </div>
                        
                        <div class="customer-card-field">
                            <div class="customer-card-label">المصدر</div>
                            <div class="customer-card-value">
                                <span class="customer-card-source-icon">${getSourceIcon(c.source)}</span>
                                ${getSourceName(c.source)}
                            </div>
                        </div>
                        
                        <div class="customer-card-field">
                            <div class="customer-card-label">تاريخ البداية</div>
                            <div class="customer-card-value">${formatDateArabic(new Date(c.startDate))}</div>
                        </div>
                        
                        <div class="customer-card-field">
                            <div class="customer-card-label">تاريخ الانتهاء</div>
                            <div class="customer-card-value">${formatDateArabic(new Date(c.endDate))}</div>
                        </div>
                        
                        ${c.notes ? `
                        <div class="customer-card-field full-width">
                            <div class="customer-card-label">ملاحظات</div>
                            <div class="customer-card-value" style="color: var(--gray); font-size: 13px;">${c.notes}</div>
                        </div>
                        ` : ''}
                    </div>
                    
                    <!-- EXPANDABLE FOOTER -->
                    <div class="customer-card-footer" onclick="event.stopPropagation()">
                        <span class="customer-card-status status-${st.status}">
                            <i class="fas fa-circle" style="font-size: 8px;"></i>
                            ${st.text}
                        </span>
                        <div class="customer-card-actions">
                            <button class="action-btn renew" onclick="renewCustomer(${c.id})" title="تجديد الاشتراك">
                                <i class="fas fa-sync-alt"></i>
                            </button>
                            <button class="action-btn delete" onclick="deleteCustomer(${c.id})" title="حذف العميل">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                </div>`;
            }).join('')}
        </div>`;
    
    container.innerHTML = tableHTML + cardsHTML;
}

function renderCustomers() {
    const container = document.getElementById('customersTableContainer');
    const search = document.getElementById('customerSearch')?.value?.toLowerCase() || '';
    const statusFilter = document.getElementById('statusFilter')?.value || 'all';
    
    let filtered = customers;
    if (search) {
        filtered = filtered.filter(c => 
            c.name.toLowerCase().includes(search) || 
            c.serviceName.toLowerCase().includes(search)
        );
    }
    if (statusFilter !== 'all') {
        filtered = filtered.filter(c => getStatus(c).status === statusFilter);
    }
    
    filtered = sortCustomersByPriority(filtered);
    
    // عداد يوضّح إجمالي / المعروض
    const counterHTML = `
        <div style="margin-bottom: 15px; padding: 12px 18px; background: rgba(99,102,241,0.08); border-radius: 14px; border: 1px solid var(--glass-border); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
            <span style="font-weight: 700; color: var(--primary); font-size: 15px;">
                <i class="fas fa-users"></i> إجمالي العملاء: ${customers.length}
            </span>
            <span style="color: var(--gray); font-size: 14px; font-weight: 600;">
                ${filtered.length === customers.length 
                    ? 'معروض: الكل ✓' 
                    : `معروض: <span style="color: var(--warning);">${filtered.length}</span> من ${customers.length} (فلتر نشط)`}
            </span>
        </div>
    `;
    
    if (filtered.length === 0) {
        container.innerHTML = counterHTML + `
            <div class="empty-state">
                <div class="empty-state-icon">📋</div>
                <div class="empty-state-title">لا يوجد عملاء مطابقين</div>
                <div class="empty-state-text">جرب تغيير الفلتر أو البحث</div>
            </div>`;
        return;
    }
    
    container.innerHTML = counterHTML + buildCustomerTable(filtered, false) + buildCustomerCards(filtered, false);
}

function renderServices() {
    const grid = document.getElementById('servicesGrid');
    
    if (!grid) {
        console.error('❌ servicesGrid مش موجود في DOM!');
        return;
    }
    
    // ✅ تأكد إن services مصفوفة
    if (!Array.isArray(services)) {
        console.error('❌ services مش مصفوفة!', services);
        services = [];
    }
    
    if (services.length === 0) {
        grid.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1;">
                <div class="empty-state-icon">📦</div>
                <div class="empty-state-title">لا توجد خدمات</div>
                <div class="empty-state-text">أضف خدمتك الأولى لتبدأ</div>
                <button class="btn btn-primary" onclick="openServiceModal()">
                    <i class="fas fa-plus"></i> إضافة خدمة جديدة
                </button>
            </div>`;
        return;
    }
    
    // ✅ حدث عدد العملاء لكل خدمة
    services.forEach(s => {
        s.customers = customers.filter(c => c.serviceId === s.id).length;
    });
    
    // ✅ بني HTML
    const html = services.map(s => `
        <div class="service-card" data-service-id="${s.id}">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                <div class="service-icon">${s.icon}</div>
                <button class="action-btn delete" onclick="deleteService(${s.id})" title="حذف الخدمة">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
            <div class="service-name">${s.name}</div>
            <div class="service-price">${s.price} ج.م</div>
            <div class="service-stats">
                <div class="service-stat">
                    <strong>${s.customers}</strong>
                    عميل
                </div>
                <div class="service-stat">
                    <strong>${s.customers * s.price} ج.م</strong>
                    إيرادات
                </div>
            </div>
        </div>
    `).join('');
    
    grid.innerHTML = html;
    
    console.log('✅ renderServices:', services.length, 'خدمة');
}

function renderExpiring() {
    const container = document.getElementById('expiringContainer');
    const expiring = customers.filter(c => {
        const st = getStatus(c);
        return st.status === 'expiring' || st.status === 'expired';
    });
    
    if (expiring.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">✅</div>
                <div class="empty-state-title">لا توجد اشتراكات منتهية</div>
                <div class="empty-state-text">كل الاشتراكات نشطة حالياً</div>
            </div>`;
        return;
    }
    
    container.innerHTML = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>العميل</th>
                    <th>الخدمة</th>
                    <th>تاريخ الانتهاء</th>
                    <th>الحالة</th>
                    <th>الإجراءات</th>
                </tr>
            </thead>
            <tbody>
                ${expiring.map(c => {
                    const st = getStatus(c);
                    return `
                    <tr>
                        <td>
                            <div class="customer-info" style="cursor:pointer" onclick="showCustomerProfile('${c.customerId}')">
                                <div class="customer-avatar">${c.name.charAt(0)}</div>
                                <div>
                                    <div class="customer-name">${c.name}</div>
                                    <div class="customer-source">${getSourceIcon(c.source)} ${getSourceName(c.source)}</div>
                                </div>
                            </div>
                        </td>
                        <td><span class="service-tag">${c.serviceIcon} ${c.serviceName}</span></td>
                        <td>${formatDateArabic(new Date(c.endDate))}</td>
                        <td><span class="status-badge ${st.class}">${st.text}</span></td>
                        <td>
                            <div class="action-btns">
                                <button class="action-btn renew" onclick="openRenewalModal('${c.customerId}', ${c.id})" title="تجديد"><i class="fas fa-sync-alt"></i></button>
                                <button class="action-btn delete" onclick="deleteCustomer(${c.id})" title="حذف"><i class="fas fa-trash"></i></button>
                            </div>
                        </td>
                    </tr>`;
                }).join('')}
            </tbody>
        </table>`;
}

function updateBadges() {
    document.getElementById('customerCountBadge').textContent = customers.length;
    
    const expiringCount = customers.filter(c => getStatus(c).status === 'expiring').length;
    const expiringBadge = document.getElementById('expiringBadge');
    if (expiringCount > 0) {
        expiringBadge.textContent = expiringCount;
        expiringBadge.style.display = 'inline-block';
    } else {
        expiringBadge.style.display = 'none';
    }
}

// ===================== NOTIFICATION QUEUE SYSTEM =====================
let notificationQueue = [];
let dismissedNotificationIds = JSON.parse(localStorage.getItem('sub_dismissed_notifications') || '[]');
let playedSoundIds = JSON.parse(localStorage.getItem('sub_played_sounds') || '[]');
const NOTIFICATION_REPEAT_INTERVAL = 60000; // 1 minute repeat for expiring alerts
const AUTO_DISMISS_MS = 5000; // 5 seconds auto-dismiss
let repeatTimers = {};
let autoDismissTimers = {};

function showNotification(message, type = 'success', options = {}) {
    const notifId = options.id || ('notif_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9));
    
    // If this notification was permanently dismissed and NOT a repeat alert, don't show
    if (dismissedNotificationIds.includes(notifId) && !options.repeat) {
        return;
    }
    
    const notifData = {
        id: notifId,
        message: message,
        type: type,
        timestamp: Date.now(),
        options: options,
        soundPlayed: playedSoundIds.includes(notifId)
    };
    
    // Add to queue
    notificationQueue.push(notifData);
    
    // If this is an expiring subscription alert, set up repeating
    if (options.repeat && options.customerId) {
        scheduleRepeatNotification(notifData);
    }
    
    renderNotificationStack();
    
    // Play sound ONLY if not already played for this notification
    if (!notifData.soundPlayed) {
        playSound(type === 'danger' ? 'alert' : 'success');
        playedSoundIds.push(notifId);
        localStorage.setItem('sub_played_sounds', JSON.stringify(playedSoundIds));
    }
    
    // Auto-dismiss after 5 seconds if user doesn't interact
    scheduleAutoDismiss(notifData);
}

function scheduleAutoDismiss(notifData) {
    // Clear existing timer for this notification
    if (autoDismissTimers[notifData.id]) {
        clearTimeout(autoDismissTimers[notifData.id]);
    }
    
    autoDismissTimers[notifData.id] = setTimeout(() => {
        // Check if still in queue (user didn't dismiss manually)
        const stillInQueue = notificationQueue.some(n => n.id === notifData.id);
        if (stillInQueue) {
            // Remove from queue
            notificationQueue = notificationQueue.filter(n => n.id !== notifData.id);
            
            // For NORMAL notifications (not repeat): mark as dismissed permanently so they never come back
            if (!notifData.options.repeat) {
                if (!dismissedNotificationIds.includes(notifData.id)) {
                    dismissedNotificationIds.push(notifData.id);
                    localStorage.setItem('sub_dismissed_notifications', JSON.stringify(dismissedNotificationIds));
                }
            }
            // For REPEAT notifications (expiring subscriptions): DON'T mark as dismissed
            // so the repeat timer will bring them back after NOTIFICATION_REPEAT_INTERVAL
            
            renderNotificationStack();
        }
        delete autoDismissTimers[notifData.id];
    }, AUTO_DISMISS_MS);
}

function renderNotificationStack() {
    const stack = document.getElementById('notificationStack');
    const stackBody = document.getElementById('stackBody');
    const stackCount = document.getElementById('stackCount');
    
    if (!stack || !stackBody || !stackCount) return;
    
    // Filter out dismissed non-repeat notifications
    const visibleQueue = notificationQueue.filter(n => {
        if (n.options.repeat) return true; // repeat notifications always visible in queue
        return !dismissedNotificationIds.includes(n.id);
    });
    
    if (visibleQueue.length === 0) {
        stack.style.display = 'none';
        return;
    }
    
    stack.style.display = 'block';
    stackCount.textContent = visibleQueue.length;
    
    // Show only the first notification in the stack body
    const current = visibleQueue[0];
    
    const icons = {
        success: '✅',
        warning: '⚠️',
        danger: '🚨'
    };
    
    const titles = {
        success: 'تم بنجاح',
        warning: 'تنبيه',
        danger: 'تنبيه مهم'
    };
    
    stackBody.innerHTML = `
        <div class="notification ${current.type}" data-notif-id="${current.id}" id="activeNotif_${current.id}">
            <button class="notification-dismiss" onclick="dismissNotification('${current.id}')" title="شفتها ✅">
                <i class="fas fa-check"></i>
            </button>
            <div class="notification-icon">${icons[current.type] || 'ℹ️'}</div>
            <div class="notification-content">
                <h4>${titles[current.type] || 'تنبيه'}</h4>
                <p>${current.message}</p>
            </div>
        </div>
    `;
    
    // Add swipe support to the active notification
    setTimeout(() => {
        const notifEl = document.getElementById('activeNotif_' + current.id);
        if (notifEl) {
            initSwipeDismiss(notifEl, current.id);
        }
    }, 50);
}

function dismissNotification(id) {
    // Stop auto-dismiss timer
    if (autoDismissTimers[id]) {
        clearTimeout(autoDismissTimers[id]);
        delete autoDismissTimers[id];
    }
    
    // Stop repeating this notification if it's a repeat alert
    stopRepeatNotification(id);
    
    // For ALL notifications (repeat or not), when manually dismissed:
    // Add to dismissed list so they don't show again in this session
    if (!dismissedNotificationIds.includes(id)) {
        dismissedNotificationIds.push(id);
        localStorage.setItem('sub_dismissed_notifications', JSON.stringify(dismissedNotificationIds));
    }
    
    // Remove from queue
    notificationQueue = notificationQueue.filter(n => n.id !== id);
    
    renderNotificationStack();
    playSound('success');
}

function dismissAllNotifications() {
    notificationQueue.forEach(n => {
        if (autoDismissTimers[n.id]) {
            clearTimeout(autoDismissTimers[n.id]);
            delete autoDismissTimers[n.id];
        }
        stopRepeatNotification(n.id);
        if (!dismissedNotificationIds.includes(n.id)) {
            dismissedNotificationIds.push(n.id);
        }
    });
    
    localStorage.setItem('sub_dismissed_notifications', JSON.stringify(dismissedNotificationIds));
    notificationQueue = [];
    renderNotificationStack();
    playSound('success');
}

// ===================== SWIPE TO DISMISS =====================
function initSwipeDismiss(element, notifId) {
    let startX = 0;
    let currentX = 0;
    let isDragging = false;
    const threshold = 100;
    
    const startDrag = (e) => {
        isDragging = true;
        startX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
        element.classList.add('swiping');
    };
    
    const moveDrag = (e) => {
        if (!isDragging) return;
        e.preventDefault();
        currentX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
        const diff = currentX - startX;
        
        if (diff < 0) {
            element.style.transform = `translateX(${diff}px)`;
            if (Math.abs(diff) > threshold / 2) {
                element.classList.add('swipe-left');
            } else {
                element.classList.remove('swipe-left');
            }
        }
    };
    
    const endDrag = () => {
        if (!isDragging) return;
        isDragging = false;
        element.classList.remove('swiping');
        const diff = currentX - startX;
        
        if (Math.abs(diff) > threshold) {
            element.classList.add('dismissed');
            setTimeout(() => dismissNotification(notifId), 300);
        } else {
            element.style.transform = '';
            element.classList.remove('swipe-left');
        }
    };
    
    element.addEventListener('touchstart', startDrag, { passive: true });
    element.addEventListener('touchmove', moveDrag, { passive: false });
    element.addEventListener('touchend', endDrag);
    
    element.addEventListener('mousedown', startDrag);
    document.addEventListener('mousemove', moveDrag);
    document.addEventListener('mouseup', endDrag);
}

// ===================== REPEAT NOTIFICATIONS (Expiring Subscriptions) =====================
function scheduleRepeatNotification(notifData) {
    stopRepeatNotification(notifData.id);
    
    repeatTimers[notifData.id] = setInterval(() => {
        // Check if still not manually dismissed
        if (!dismissedNotificationIds.includes(notifData.id)) {
            // Re-add to queue if not already there
            const exists = notificationQueue.some(n => n.id === notifData.id);
            if (!exists) {
                const repeatedNotif = {
                    ...notifData,
                    soundPlayed: true // Sound already played, don't play again
                };
                notificationQueue.push(repeatedNotif);
                scheduleAutoDismiss(repeatedNotif);
            }
            renderNotificationStack();
        } else {
            stopRepeatNotification(notifData.id);
        }
    }, NOTIFICATION_REPEAT_INTERVAL);
}

function stopRepeatNotification(id) {
    if (repeatTimers[id]) {
        clearInterval(repeatTimers[id]);
        delete repeatTimers[id];
    }
}

// ===================== CLEAR OLD DISMISSED NOTIFICATIONS =====================
function clearOldDismissedNotifications() {
    const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    
    dismissedNotificationIds = dismissedNotificationIds.filter(id => {
        try {
            const timestamp = parseInt(id.split('_')[1]);
            return timestamp > oneWeekAgo;
        } catch {
            return true;
        }
    });
    localStorage.setItem('sub_dismissed_notifications', JSON.stringify(dismissedNotificationIds));
    
    playedSoundIds = playedSoundIds.filter(id => {
        try {
            const timestamp = parseInt(id.split('_')[1]);
            return timestamp > oneWeekAgo;
        } catch {
            return true;
        }
    });
    localStorage.setItem('sub_played_sounds', JSON.stringify(playedSoundIds));
}

// Run cleanup on startup
clearOldDismissedNotifications();

// ===================== CLEAR OLD DISMISSED NOTIFICATIONS =====================
function clearOldDismissedNotifications() {
    const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    
    // Clean dismissed IDs
    dismissedNotificationIds = dismissedNotificationIds.filter(id => {
        try {
            const timestamp = parseInt(id.split('_')[1]);
            return timestamp > oneWeekAgo;
        } catch {
            return true;
        }
    });
    localStorage.setItem('sub_dismissed_notifications', JSON.stringify(dismissedNotificationIds));
    
    // Clean played sound IDs (same logic)
    playedSoundIds = playedSoundIds.filter(id => {
        try {
            const timestamp = parseInt(id.split('_')[1]);
            return timestamp > oneWeekAgo;
        } catch {
            return true;
        }
    });
    localStorage.setItem('sub_played_sounds', JSON.stringify(playedSoundIds));
}

// Run cleanup on startup
clearOldDismissedNotifications();

// Run cleanup on startup
clearOldDismissedNotifications();

function playSound(type) {
    if (!soundEnabled) return;
    
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    if (type === 'success') {
        oscillator.frequency.setValueAtTime(523.25, audioCtx.currentTime);
        oscillator.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.1);
        oscillator.frequency.setValueAtTime(783.99, audioCtx.currentTime + 0.2);
    } else if (type === 'alert') {
        oscillator.frequency.setValueAtTime(800, audioCtx.currentTime);
        oscillator.frequency.setValueAtTime(600, audioCtx.currentTime + 0.2);
        oscillator.frequency.setValueAtTime(800, audioCtx.currentTime + 0.4);
    }
    
    gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
    
    oscillator.start(audioCtx.currentTime);
    oscillator.stop(audioCtx.currentTime + 0.5);
}

function toggleSound() {
    soundEnabled = !soundEnabled;
    localStorage.setItem('sub_sound', soundEnabled);
    updateSoundIcon();
    showNotification(soundEnabled ? '🔊 تم تشغيل الصوت' : '🔇 تم إيقاف الصوت', 'success');
}

function updateSoundIcon() {
    const icon = document.getElementById('soundIcon');
    const btn = document.getElementById('soundToggle');
    if (soundEnabled) {
        icon.className = 'fas fa-volume-up';
        btn.classList.remove('muted');
    } else {
        icon.className = 'fas fa-volume-mute';
        btn.classList.add('muted');
    }
}

// ===================== EXPORT DROPDOWN =====================
function toggleExportMenu() {
    const menu = document.getElementById('exportMenu');
    if (menu) menu.classList.toggle('show');
}

// Close export menu when clicking outside
document.addEventListener('click', function(e) {
    if (!e.target.closest('.export-dropdown')) {
        const menu = document.getElementById('exportMenu');
        if (menu) menu.classList.remove('show');
    }
});

// ===================== EXPIRING CHECKER =====================
function checkExpiringSubscriptions() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const expiringTomorrow = [];
    const expiringToday = [];
    const expiredToday = [];
    
    customers.forEach(customer => {
        const endDate = new Date(customer.endDate);
        endDate.setHours(0, 0, 0, 0);
        
        const diffDays = Math.round((endDate - today) / (1000 * 60 * 60 * 24));
        
        const notifId = `expiring_${customer.id}_${formatDate(today)}`;
        
        // ينتهي بكرة
        if (diffDays === 1 && customer.status !== 'completed') {
            showNotification(
                `⏰ اشتراك ${customer.name} ينتهي غداً! (${customer.serviceName})`,
                'warning',
                { id: notifId, repeat: true, customerId: customer.id }
            );
            expiringTomorrow.push(customer);
        }
        
        // ينتهي اليوم
        if (diffDays === 0 && customer.status !== 'completed') {
            showNotification(
                `⚠️ اشتراك ${customer.name} ينتهي اليوم! (${customer.serviceName})`,
                'warning',
                { id: notifId, repeat: true, customerId: customer.id }
            );
            expiringToday.push(customer);
        }
        
        // انتهى
        if (diffDays < 0 && customer.status !== 'completed') {
            showNotification(
                `🚨 اشتراك ${customer.name} انتهى! (${customer.serviceName})`,
                'danger',
                { id: notifId, repeat: true, customerId: customer.id }
            );
            expiredToday.push(customer);
            customer.status = 'completed';
            saveData();
            renderAll();
        }
    });
    
    // إرسال Push Notifications
    if (pushEnabled && Notification.permission === 'granted') {
        const lastPushDate = localStorage.getItem('sub_last_push_date');
        const todayStr = formatDate(today);
        
        if (lastPushDate !== todayStr) {
            if (expiringTomorrow.length > 0) {
                sendLocalNotification(
                    `⏰ ${expiringTomorrow.length} اشتراك ينتهي غداً!`,
                    `العملاء: ${expiringTomorrow.map(c => c.name).join('، ')}`,
                    { tag: 'expiring-tomorrow', requireInteraction: true }
                );
            }
            
            if (expiringToday.length > 0) {
                sendLocalNotification(
                    `⚠️ ${expiringToday.length} اشتراك ينتهي اليوم!`,
                    `العملاء: ${expiringToday.map(c => c.name).join('، ')}`,
                    { tag: 'expiring-today', requireInteraction: true }
                );
            }
            
            localStorage.setItem('sub_last_push_date', todayStr);
        }
    }
}

// ===================== COLLAPSIBLE CARD TOGGLE =====================
function toggleCard(card, event) {
    // Don't toggle if clicking on a button inside the card
    if (event.target.closest('button') || event.target.closest('.customer-card-body') || event.target.closest('.customer-card-footer')) {
        return;
    }
    
    // Close all other cards first (accordion style - optional, remove if you want multiple open)
    document.querySelectorAll('.customer-mobile-card.expanded').forEach(c => {
        if (c !== card) c.classList.remove('expanded');
    });
    
    // Toggle current card
    card.classList.toggle('expanded');
    
    // Add a subtle animation
    if (card.classList.contains('expanded')) {
        card.style.transform = 'scale(1.02)';
        setTimeout(() => {
            card.style.transform = '';
        }, 200);
    }
}

// ===================== EXPENSE CARD TOGGLE =====================
function toggleExpenseCard(card, event) {
    // Don't toggle if clicking on a button inside the card
    if (event.target.closest('button') || event.target.closest('.expense-card-body') || event.target.closest('.expense-card-footer')) {
        return;
    }
    
    // Close all other expense cards first
    document.querySelectorAll('.expense-mobile-card.expanded').forEach(c => {
        if (c !== card) c.classList.remove('expanded');
    });
    
    // Toggle current card
    card.classList.toggle('expanded');
    
    // Add a subtle animation
    if (card.classList.contains('expanded')) {
        card.style.transform = 'scale(1.02)';
        setTimeout(() => {
            card.style.transform = '';
        }, 200);
    }
}

// ===================== FILTER =====================
function filterCustomers() {
    renderCustomers();
}

// ===================== SAVE =====================
function saveData() {
    try {
        localStorage.setItem('sub_customers', JSON.stringify(customers));
        localStorage.setItem('sub_services', JSON.stringify(services));
        localStorage.setItem('sub_expenses', JSON.stringify(expenses));
        
        console.log('💾 تم الحفظ:', {
            customers: customers.length,
            services: services.length,
            expenses: expenses.length
        });
    } catch (err) {
        console.error('❌ خطأ في الحفظ:', err);
        showNotification('⚠️ خطأ في حفظ البيانات', 'warning');
    }
}

// ===================== SETTINGS =====================
let settings = JSON.parse(localStorage.getItem('sub_settings')) || {
    merchantName: '',
    merchantEmail: '',
    autoNotify: true
};

function openSettingsModal() {
    const modal = document.getElementById('settingsModal');
    if (modal) {
        modal.style.display = 'flex';
        setTimeout(() => {
            modal.classList.add('show');
        }, 10);
    }

    // Load current settings
    const merchantName = localStorage.getItem('sub_merchant_name') || '';
    const merchantNameInput = document.getElementById('merchantName');
    if (merchantNameInput) merchantNameInput.value = merchantName;

    const autoNotifyInput = document.getElementById('autoNotify');
    if (autoNotifyInput) autoNotifyInput.checked = settings.autoNotify !== false;

    const sheetsUrlInput = document.getElementById('sheetsVerifyUrl');
    const sheetsSecretInput = document.getElementById('sheetsVerifySecret');
    if (sheetsUrlInput) sheetsUrlInput.value = getSheetsVerifyUrl();
    if (sheetsSecretInput) sheetsSecretInput.value = getSheetsVerifySecret();

    // If already admin, auto-show admin controls
    if (isAdmin() || isAdminLoggedIn) {
        const loginForm = document.getElementById('adminLoginForm');
        const controlsArea = document.getElementById('adminControlsArea');
        if (loginForm) loginForm.style.display = 'none';
        if (controlsArea) {
            controlsArea.style.display = 'block';
            settingsAdminVerified = true;
        }
    } else {
        // Reset admin access for non-admin users
        resetSettingsAdminAccess();
    }
        // Clear settings activation code inputs to fix auto-char bug
    document.querySelectorAll('.settings-code-digit').forEach(input => {
        input.value = '';
        input.classList.remove('filled');
    });
    const settingsErr = document.getElementById('settingsActivationError');
    if (settingsErr) settingsErr.style.display = 'none';
}

function closeSettingsModal() {
    const modal = document.getElementById('settingsModal');
    if (modal) {
        modal.classList.remove('show');
        setTimeout(() => {
            modal.style.display = 'none';
        }, 300);
    }
    // Reset admin access when closing settings
    resetSettingsAdminAccess();
}

function saveSettings(e) {
    e.preventDefault();
    
    const name = document.getElementById('merchantName').value.trim();
    const autoNotify = document.getElementById('autoNotify').checked;
    const sheetsUrl = document.getElementById('sheetsVerifyUrl')?.value.trim() || DEFAULT_SHEETS_VERIFY_URL;
    const sheetsSecret = document.getElementById('sheetsVerifySecret')?.value.trim() || '';
    
    settings = { merchantName: name, autoNotify: autoNotify };
    localStorage.setItem(SHEETS_VERIFY_URL_KEY, sheetsUrl);
    localStorage.setItem(SHEETS_VERIFY_SECRET_KEY, sheetsSecret);
    localStorage.setItem('sub_settings', JSON.stringify(settings));
    closeSettingsModal();
    showNotification('✅ تم الحفظ!', 'success');
    playSound('success');
    
    if (autoNotify && !pushEnabled) {
        setTimeout(() => requestPushPermission(), 500);
    }
}

function getSettings() {
    return JSON.parse(localStorage.getItem('sub_settings')) || {
        merchantName: '',
        merchantEmail: '',
        autoNotify: true
    };
}

// ===================== EXPENSE CALENDAR =====================
let currentExpenseDate = new Date();
let selectedExpenseDate = null;
let expenseCalendarOpen = false;

function initExpenseCalendar() {
    renderExpenseCalendar(currentExpenseDate);
    
    document.addEventListener('click', function(e) {
        if (!e.target.closest('#expenseDateDisplay') && !e.target.closest('#expenseCalendar')) {
            closeExpenseCalendar();
        }
    });
}

function renderExpenseCalendar(date) {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();
    
    const monthNames = ['يناير', 'فبراير', 'مارس', 'إبريل', 'مايو', 'يونيو', 
                       'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
    
    document.getElementById('expenseCalendarTitle').textContent = monthNames[month] + ' ' + year;
    
    const grid = document.getElementById('expenseCalendarGrid');
    grid.innerHTML = '';
    
    const dayHeaders = ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];
    dayHeaders.forEach(d => {
        const el = document.createElement('div');
        el.className = 'calendar-day-header';
        el.textContent = d;
        grid.appendChild(el);
    });
    
    for (let i = 0; i < firstDay; i++) {
        const el = document.createElement('div');
        el.className = 'calendar-day other-month';
        el.textContent = daysInPrevMonth - firstDay + i + 1;
        grid.appendChild(el);
    }
    
    const today = new Date();
    for (let i = 1; i <= daysInMonth; i++) {
        const el = document.createElement('div');
        el.className = 'calendar-day';
        el.textContent = i;
        
        const thisDate = new Date(year, month, i);
        
        if (thisDate.toDateString() === today.toDateString()) {
            el.classList.add('today');
        }
        
        if (selectedExpenseDate && thisDate.toDateString() === selectedExpenseDate.toDateString()) {
            el.classList.add('selected');
        }
        
        el.onclick = () => selectExpenseDate(thisDate);
        grid.appendChild(el);
    }
    
    const remaining = (7 - ((firstDay + daysInMonth) % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
        const el = document.createElement('div');
        el.className = 'calendar-day other-month';
        el.textContent = i;
        grid.appendChild(el);
    }
}

function changeExpenseMonth(delta) {
    currentExpenseDate.setMonth(currentExpenseDate.getMonth() + delta);
    renderExpenseCalendar(currentExpenseDate);
}

function toggleExpenseCalendar() {
    const cal = document.getElementById('expenseCalendar');
    expenseCalendarOpen = !expenseCalendarOpen;
    cal.classList.toggle('show', expenseCalendarOpen);
}

function closeExpenseCalendar() {
    document.getElementById('expenseCalendar').classList.remove('show');
    expenseCalendarOpen = false;
}

function selectExpenseDate(date) {
    selectedExpenseDate = date;
    document.getElementById('expenseDate').value = formatDate(date);
    document.getElementById('expenseDateText').textContent = formatDateArabic(date);
    renderExpenseCalendar(currentExpenseDate);
    closeExpenseCalendar();
}

// ===================== EXPENSES =====================
function openExpenseModal() {
    document.getElementById('expenseModal').classList.add('show');
    selectExpenseDate(new Date());
    updateExpenseServicesSelect();
}

function closeExpenseModal() {
    document.getElementById('expenseModal').classList.remove('show');
    document.getElementById('expenseService').value = '';
    document.getElementById('expenseDesc').value = '';
    document.getElementById('expenseAmount').value = '';
    document.getElementById('expenseNotes').value = '';
    selectedExpenseDate = null;
    document.getElementById('expenseDateText').textContent = 'اختر التاريخ';
    document.getElementById('expenseDate').value = '';
    currentExpenseDate = new Date();
    renderExpenseCalendar(currentExpenseDate);
    closeExpenseCalendar();
}

function updateExpenseServicesSelect() {
    const select = document.getElementById('expenseService');
    select.innerHTML = '<option value="">اختر الخدمة</option>';
    services.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.id;
        opt.textContent = s.icon + ' ' + s.name;
        select.appendChild(opt);
    });
}

function updateExpenseServiceName() {
    const serviceId = parseInt(document.getElementById('expenseService').value);
    const service = services.find(s => s.id === serviceId);
    if (service) {
        const descInput = document.getElementById('expenseDesc');
        if (!descInput.value.trim()) {
            descInput.value = service.name;
        }
    }
}

function addExpense(e) {
    e.preventDefault();
    const serviceId = parseInt(document.getElementById('expenseService').value);
    const desc = document.getElementById('expenseDesc').value.trim();
    const amount = parseFloat(document.getElementById('expenseAmount').value);
    const date = document.getElementById('expenseDate').value;
    const notes = document.getElementById('expenseNotes').value.trim();
    
    if (!serviceId || !amount) {
        showNotification('⚠️ يرجى اختيار الخدمة وإدخال المبلغ', 'warning');
        return;
    }
    
    const service = services.find(s => s.id === serviceId);
    const expense = {
        id: Date.now(),
        serviceId,
        serviceName: service.name,
        serviceIcon: service.icon,
        desc: desc || service.name,
        amount,
        date: date || formatDate(new Date()),
        notes
    };
    
    expenses.push(expense);
    saveExpenses();
    renderFinance();
    closeExpenseModal();
    showNotification('💸 تم إضافة مصروف: ' + (desc || service.name) + ' (' + amount + ' ج.م)', 'success');
}

function deleteExpense(id) {
    if (confirm('هل أنت متأكد من حذف هذا المصروف؟')) {
        expenses = expenses.filter(e => e.id !== id);
        saveExpenses();
        renderFinance();
        showNotification('🗑️ تم حذف المصروف', 'success');
    }
}

function saveExpenses() {
    localStorage.setItem('sub_expenses', JSON.stringify(expenses));
}

// ===================== AUTO PURCHASE EXPENSES =====================
function migratePurchaseExpenses() {
    const migratedFlag = localStorage.getItem('sub_purchase_expenses_migrated_v2');
    if (migratedFlag) return;
    
    let addedCount = 0;
    customers.forEach(c => {
        if (c.costPrice && parseFloat(c.costPrice) > 0) {
            // شيك لو فيه مصروف موجودة بالفعل لهذا العميل
            const exists = expenses.some(e => e.customerId === c.id && e.isAutoPurchase);
            if (!exists) {
                const supplier = suppliers.find(s => s.id == c.supplierId);
                expenses.push({
                    id: Date.now() + Math.random(),
                    serviceId: c.serviceId,
                    serviceName: c.serviceName || 'خدمة',
                    serviceIcon: c.serviceIcon || '📦',
                    desc: `شراء من المورد - ${supplier ? supplier.name : 'غير محدد'} (${c.name})`,
                    amount: parseFloat(c.costPrice),
                    date: c.startDate || formatDate(new Date()),
                    notes: `مصروف شراء تلقائي - عميل: ${c.name}`,
                    customerId: c.id,
                    isAutoPurchase: true
                });
                addedCount++;
            }
        }
    });
    
    if (addedCount > 0) {
        saveExpenses();
        console.log(`✅ تم ترحيل ${addedCount} مصروف شراء للعملاء القدام`);
    }
    localStorage.setItem('sub_purchase_expenses_migrated_v2', 'true');
}

// ===================== FINANCE RENDERING =====================
function renderFinance() {
    const totalCost = customers.reduce((sum, c) => sum + (parseFloat(c.costPrice) || 0), 0);
    const totalExpensesVal = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const totalRevenue = customers.reduce((sum, c) => sum + (parseFloat(c.sellPrice) || c.price || 0), 0);
    const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const netProfit = totalRevenue - totalExpenses;
    const profitPercentage = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : 0;
    
    document.getElementById('totalRevenueFinance').textContent = totalRevenue.toLocaleString() + ' ج.م';
    document.getElementById('totalExpenses').textContent = totalExpenses.toLocaleString() + ' ج.م';
    document.getElementById('netProfit').textContent = netProfit.toLocaleString() + ' ج.م';
    document.getElementById('profitPercentage').textContent = profitPercentage + '%';
    
    const netProfitEl = document.getElementById('netProfit');
    if (netProfit >= 0) {
        netProfitEl.style.color = 'var(--success)';
    } else {
        netProfitEl.style.color = 'var(--danger)';
    }
    
    const container = document.getElementById('expensesContainer');
    if (expenses.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">💸</div>
                <div class="empty-state-title">لا توجد مصروفات</div>
                <div class="empty-state-text">أضف مصروفاتك لحساب صافي الربح</div>
                <button class="btn btn-primary" onclick="openExpenseModal()">
                    <i class="fas fa-plus"></i> إضافة مصروف
                </button>
            </div>`;
    } else {
        // ===== DESKTOP TABLE =====
        const tableHTML = `
            <table class="expense-table">
                <thead>
                    <tr>
                        <th>الخدمة</th>
                        <th>الوصف</th>
                        <th>المبلغ</tثh>
                        <th>التاريخ</th>
                        <th>إجراء</th>
                    </tr>
                </thead>
                <tbody>
                    ${expenses.slice().reverse().map(e => `
                        <tr>
                            <td><span class="service-tag">${e.serviceIcon || '📦'} ${e.serviceName || e.desc}</span></td>
                            <td style="color: var(--gray); font-size: 13px;">
    ${e.isAutoPurchase ? '<span style="color:var(--warning);font-size:11px;">[تلقائي]</span> ' : ''}
    ${e.desc !== e.serviceName ? e.desc : '-'} ${e.notes ? '<br><span style="font-size: 11px; opacity: 0.7;">' + e.notes + '</span>' : ''}</td>
                            <td class="expense-amount">-${e.amount.toLocaleString()} ج.م</td>
                            <td>${formatDateArabic(new Date(e.date))}</td>
                            <td>
                                <button class="action-btn delete" onclick="deleteExpense(${e.id})" title="حذف">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>`;
        
        // ===== MOBILE COLLAPSIBLE CARDS =====
        const cardsHTML = `
            <div class="expenses-mobile-cards">
                ${expenses.slice().reverse().map(e => `
                    <div class="expense-mobile-card" onclick="toggleExpenseCard(this, event)" data-expense-id="${e.id}">
                        
                        <!-- COLLAPSED HEADER -->
                        <div class="expense-card-header">
                            <div class="expense-card-icon">
                                ${e.serviceIcon || '📦'}
                            </div>
                            <div class="expense-card-info">
                                <div class="expense-card-name">
                                    ${e.desc || e.serviceName || 'مصروف'}
                                </div>
                                <div class="expense-card-service">
                                    <span class="service-icon">${e.serviceIcon || '📦'}</span>
                                    ${e.serviceName || 'خدمة'}
                                </div>
                            </div>
                            <div class="expense-card-meta">
                                <div class="expense-card-amount">-${e.amount.toLocaleString()} ج.م</div>
                                <div class="expense-card-date-compact">${formatDateArabic(new Date(e.date))}</div>
                            </div>
                        </div>
                        
                        <div class="expense-card-expand">
                            <i class="fas fa-chevron-down"></i>
                        </div>
                        
                        <!-- EXPANDABLE BODY -->
                        <div class="expense-card-body" onclick="event.stopPropagation()">
                            <div class="expense-card-field">
                                <div class="expense-card-label">الخدمة</div>
                                <div class="expense-card-value">
                                    <span class="service-icon">${e.serviceIcon || '📦'}</span>
                                    ${e.serviceName || '-'}
                                </div>
                            </div>
                            
                            <div class="expense-card-field">
                                <div class="expense-card-label">المبلغ</div>
                                <div class="expense-card-value amount">-${e.amount.toLocaleString()} ج.م</div>
                            </div>
                            
                            <div class="expense-card-field">
                                <div class="expense-card-label">التاريخ</div>
                                <div class="expense-card-value">${formatDateArabic(new Date(e.date))}</div>
                            </div>
                            
                            <div class="expense-card-field">
                                <div class="expense-card-label">الوصف</div>
                                <div class="expense-card-value">${e.desc !== e.serviceName ? e.desc : '-'}</div>
                            </div>
                            
                            ${e.notes ? `
                            <div class="expense-card-field full-width">
                                <div class="expense-card-label">ملاحظات</div>
                                <div class="expense-card-value" style="color: var(--gray); font-size: 13px;">${e.notes}</div>
                            </div>
                            ` : ''}
                        </div>
                        
                        <!-- EXPANDABLE FOOTER -->
                        <div class="expense-card-footer" onclick="event.stopPropagation()">
                            <div class="expense-card-total">
                                المبلغ: <strong>-${e.amount.toLocaleString()} ج.م</strong>
                            </div>
                            <div class="expense-card-actions">
                                <button class="action-btn delete" onclick="deleteExpense(${e.id})" title="حذف المصروف">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>`;
        
        container.innerHTML = tableHTML + cardsHTML;
    }
    
    const maxVal = Math.max(totalRevenue, totalExpenses, Math.abs(netProfit));
    const breakdown = document.getElementById('profitBreakdown');
    breakdown.innerHTML = `
        <div class="finance-chart">
            <div class="finance-chart-bar">
                <div class="finance-bar-item">
                    <div class="finance-bar-label">
                        <span>💰 الإيرادات</span>
                        <span style="color: var(--success);">${totalRevenue.toLocaleString()} ج.م</span>
                    </div>
                    <div class="finance-bar-track">
                        <div class="finance-bar-fill revenue" style="width: ${maxVal > 0 ? (totalRevenue / maxVal * 100) : 0}%"></div>
                    </div>
                </div>
                <div class="finance-bar-item">
                    <div class="finance-bar-label">
                        <span>💸 المصروفات</span>
                        <span style="color: var(--danger);">${totalExpenses.toLocaleString()} ج.م</span>
                    </div>
                    <div class="finance-bar-track">
                        <div class="finance-bar-fill expense" style="width: ${maxVal > 0 ? (totalExpenses / maxVal * 100) : 0}%"></div>
                    </div>
                </div>
                <div class="finance-bar-item">
                    <div class="finance-bar-label">
                        <span>📊 صافي الربح</span>
                        <span style="color: ${netProfit >= 0 ? 'var(--success)' : 'var(--danger)'}">${netProfit.toLocaleString()} ج.م</span>
                    </div>
                    <div class="finance-bar-track">
                        <div class="finance-bar-fill profit" style="width: ${maxVal > 0 ? (Math.abs(netProfit) / maxVal * 100) : 0}%"></div>
                    </div>
                </div>
            </div>
            <div class="finance-summary">
                <div class="finance-summary-item">
                    <div class="finance-summary-value ${netProfit >= 0 ? 'positive' : 'negative'}">${netProfit.toLocaleString()}</div>
                    <div class="finance-summary-label">صافي الربح (ج.م)</div>
                </div>
                <div class="finance-summary-item">
                    <div class="finance-summary-value" style="color: var(--warning);">${profitPercentage}%</div>
                    <div class="finance-summary-label">نسبة الربح</div>
                </div>
                <div class="finance-summary-item">
                    <div class="finance-summary-value" style="color: var(--primary);">${expenses.length}</div>
                    <div class="finance-summary-label">عدد المصروفات</div>
                </div>
            </div>
        </div>
    `;
}


// ===================== NEW DATA STRUCTURES =====================
window.suppliers = [];
window.activityLog = [];
window.subscriptionHistory = [];

const DATA_KEYS = {
    customers: 'sub_customers',
    services: 'sub_services',
    expenses: 'sub_expenses',
    suppliers: 'sub_suppliers',
    stock: 'sub_stock',
    activityLog: 'sub_activity_log',
    subscriptionHistory: 'sub_subscription_history'
};

let saveTimeout = null;
let renderTimeout = null;
const statusCache = new Map();

function loadData() {
    try {
        const startTime = performance.now();
        const data = {};
        for (const [key, storageKey] of Object.entries(DATA_KEYS)) {
            try {
                const raw = localStorage.getItem(storageKey);
                data[key] = raw ? JSON.parse(raw) : [];
            } catch (e) { data[key] = []; }
        }
        window.customers = data.customers || [];
        window.services = data.services || [];
        window.expenses = data.expenses || [];
        window.suppliers = data.suppliers || [];
        window.stock = data.stock || [];
        window.activityLog = data.activityLog || [];
        window.subscriptionHistory = data.subscriptionHistory || [];
        migrateOldData();
        console.log(`Data loaded in ${(performance.now() - startTime).toFixed(1)}ms`);
    } catch (err) {
        window.customers = []; window.services = []; window.expenses = [];
        window.suppliers = []; window.activityLog = []; window.subscriptionHistory = [];
    }
        // شغل migration لما البيانات تحمل
    setTimeout(() => migratePurchaseExpenses(), 500);
}

function migrateOldData() {
    let migrated = false;
    // ✅ Feature 1: كل عميل بنفس الاسم بيتربط بملف موحّد واحد (customerId) - بدون ما نغيّر شكل تخزين الاشتراكات القديمة
    const groupByName = new Map();
    customers.forEach(c => {
        if (c.customerId) return; // عنده ملف موحّد بالفعل
        const norm = normalizeCustomerName(c.name);
        if (!groupByName.has(norm)) groupByName.set(norm, generateGroupId());
        c.customerId = groupByName.get(norm);
        migrated = true;
    });
    customers.forEach(c => {
        if (typeof c.renewCount !== 'number') { c.renewCount = c.renewedAt ? 1 : 0; migrated = true; }
        if (!c.supplierId) { c.supplierId = null; migrated = true; }
        if (!c.costPrice && c.price) { c.costPrice = c.price * 0.7; c.sellPrice = c.price; migrated = true; }
        if (!c.subscriptionHistory) {
            c.subscriptionHistory = [{
                serviceId: c.serviceId, serviceName: c.serviceName, serviceIcon: c.serviceIcon,
                startDate: c.startDate, endDate: c.endDate, costPrice: c.costPrice || 0,
                sellPrice: c.sellPrice || c.price || 0, supplierId: c.supplierId,
                status: c.status, createdAt: c.addedAt || new Date().toISOString()
            }];
            migrated = true;
        }
    });
    // Migrate old customers with direct email/password to stock reference
    customers.forEach(c => {
        if (c.deliveredEmail && !c.stockId) {
            const existing = stock.find(s => s.email === c.deliveredEmail);
            if (!existing) {
                const s = {
                    id: Date.now() + Math.random(),
                    email: c.deliveredEmail,
                    password: c.deliveredPassword || '',
                    maxUsers: 2,
                    remainingUses: 0,
                    notes: ' migrated',
                    createdAt: c.addedAt || new Date().toISOString()
                };
                stock.push(s);
                c.stockId = s.id;
                migrated = true;
            }
        }
    });
    if (migrated) { console.log('Data migration done'); saveData(); }
}

function saveData() {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
        try {
            localStorage.setItem(DATA_KEYS.customers, JSON.stringify(customers));
            localStorage.setItem(DATA_KEYS.services, JSON.stringify(services));
            localStorage.setItem(DATA_KEYS.expenses, JSON.stringify(expenses));
            localStorage.setItem(DATA_KEYS.suppliers, JSON.stringify(suppliers));
            localStorage.setItem(DATA_KEYS.stock, JSON.stringify(stock));
            localStorage.setItem(DATA_KEYS.activityLog, JSON.stringify(activityLog));
            localStorage.setItem(DATA_KEYS.subscriptionHistory, JSON.stringify(subscriptionHistory));
        } catch (err) { showNotification('Error saving data', 'warning'); }
    }, 100);
}

// ===================== ACTIVITY LOG =====================
function logActivity(type, data) {
    const entry = {
        id: Date.now() + '_' + Math.random().toString(36).substr(2,5),
        type, customerName: data.customerName||null, customerId: data.customerId||null,
        serviceName: data.serviceName||null, supplierName: data.supplierName||null,
        supplierId: data.supplierId||null, details: data.details||'',
        timestamp: new Date().toISOString(), user: 'Admin'
    };
    activityLog.unshift(entry);
    if (activityLog.length > 500) activityLog = activityLog.slice(0, 500);
    saveData();
}

function clearActivityLog() {
    if (!confirm('هل أنت متأكد من مسح سجل النشاط؟')) return;
    activityLog = []; saveData(); renderActivityLog();
    showNotification('تم مسح سجل النشاط', 'success');
}

function getActivityTypeLabel(t) {
    return {customer_create:'إنشاء عميل',customer_edit:'تعديل عميل',customer_delete:'حذف عميل',
        subscription_create:'إنشاء اشتراك',subscription_edit:'تعديل اشتراك',subscription_delete:'حذف اشتراك',
        subscription_renew:'تجديد اشتراك',subscription_status_change:'تغيير حالة',
        supplier_create:'إضافة مورد',supplier_edit:'تعديل مورد',supplier_delete:'حذف مورد',
        settings:'تعديل إعدادات'}[t] || t;
}

function getActivityIcon(t) {
    return {customer_create:'fa-user-plus',customer_edit:'fa-user-edit',customer_delete:'fa-user-times',
        subscription_create:'fa-plus-circle',subscription_edit:'fa-edit',subscription_delete:'fa-trash-alt',
        subscription_renew:'fa-sync-alt',subscription_status_change:'fa-exchange-alt',
        supplier_create:'fa-truck',supplier_edit:'fa-edit',supplier_delete:'fa-trash-alt',
        settings:'fa-cog'}[t] || 'fa-info-circle';
}

function formatRelativeTime(ds) {
    const d = new Date(ds), now = new Date();
    const diff = Math.floor((now-d)/1000);
    if (diff < 60) return 'الآن';
    if (diff < 3600) return `منذ ${Math.floor(diff/60)} دقيقة`;
    if (diff < 86400) return `منذ ${Math.floor(diff/3600)} ساعة`;
    if (diff < 604800) return `منذ ${Math.floor(diff/86400)} يوم`;
    return formatDateArabic(d);
}

function renderActivityLog() {
    const c = document.getElementById('activityLogContainer');
    const s = document.getElementById('activitySearch')?.value?.toLowerCase()||'';
    const tf = document.getElementById('activityTypeFilter')?.value||'all';
    const df = document.getElementById('activityDateFilter')?.value||'';
    let f = activityLog;
    if (s) f = f.filter(a => (a.customerName&&a.customerName.toLowerCase().includes(s))||(a.serviceName&&a.serviceName.toLowerCase().includes(s))||(a.supplierName&&a.supplierName.toLowerCase().includes(s))||(a.details&&a.details.toLowerCase().includes(s)));
    if (tf !== 'all') f = f.filter(a => a.type === tf);
    if (df) { const fd = new Date(df).toDateString(); f = f.filter(a => new Date(a.timestamp).toDateString() === fd); }
    if (f.length === 0) { c.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📋</div><div class="empty-state-title">لا يوجد سجل</div><div class="empty-state-text">سيتم التسجيل تلقائياً</div></div>'; return; }
    c.innerHTML = '<div class="activity-timeline">' + f.map(a => `
        <div class="activity-item ${a.type}">
            <div class="activity-content">
                <div class="activity-icon"><i class="fas ${getActivityIcon(a.type)}"></i></div>
                <div class="activity-text">
                    <div class="activity-title">${getActivityTypeLabel(a.type)}</div>
                    <div class="activity-meta">
                        ${a.customerName?`<span class="activity-badge customer"><i class="fas fa-user"></i> ${a.customerName}</span>`:''}
                        ${a.serviceName?`<span class="activity-badge subscription"><i class="fas fa-box"></i> ${a.serviceName}</span>`:''}
                        ${a.supplierName?`<span class="activity-badge supplier"><i class="fas fa-truck"></i> ${a.supplierName}</span>`:''}
                        <span><i class="far fa-clock"></i> ${formatRelativeTime(a.timestamp)}</span>
                        <span><i class="fas fa-user"></i> ${a.user}</span>
                    </div>
                    ${a.details?`<div style="margin-top:8px;color:var(--gray);font-size:13px;">${a.details}</div>`:''}
                </div>
            </div>
        </div>`).join('') + '</div>';
}
function filterActivityLog() { renderActivityLog(); }

// ===================== SUPPLIERS =====================
function openSupplierModal(sid) {
    const m = document.getElementById('supplierModal');
    const t = document.getElementById('supplierModalTitle');
    const b = document.getElementById('supplierSubmitBtn');
    const idIn = document.getElementById('supplierId');
    if (sid) {
        const s = suppliers.find(x => x.id === sid); if (!s) return;
        t.textContent = 'تعديل مورد'; b.textContent = 'حفظ التعديلات';
        idIn.value = s.id; document.getElementById('supplierName').value = s.name;
        document.getElementById('supplierPhone').value = s.phone||'';
        document.getElementById('supplierStatus').value = s.status||'active';
        document.getElementById('supplierNotes').value = s.notes||'';
    } else {
        t.textContent = 'إضافة مورد جديد'; b.textContent = 'إضافة المورد';
        idIn.value = ''; document.getElementById('supplierName').value = '';
        document.getElementById('supplierPhone').value = '';
        document.getElementById('supplierStatus').value = 'active';
        document.getElementById('supplierNotes').value = '';
    }
    m.classList.add('show');
}
function closeSupplierModal() { document.getElementById('supplierModal').classList.remove('show'); }

function saveSupplier(e) {
    e.preventDefault();
    const id = document.getElementById('supplierId').value;
    const name = document.getElementById('supplierName').value.trim();
    const phone = document.getElementById('supplierPhone').value.trim();
    const status = document.getElementById('supplierStatus').value;
    const notes = document.getElementById('supplierNotes').value.trim();
    if (!name) { showNotification('أدخل اسم المورد', 'warning'); return; }
    if (id) {
        const s = suppliers.find(x => x.id == id);
        if (s) { s.name=name; s.phone=phone; s.status=status; s.notes=notes; s.updatedAt=new Date().toISOString();
            logActivity('supplier_edit',{supplierName:name,supplierId:s.id,details:`تعديل ${name}`});
            showNotification('تم تعديل '+name, 'success');
        }
    } else {
        const s = {id:Date.now(),name,phone,status,notes,createdAt:new Date().toISOString()};
        suppliers.push(s);
        logActivity('supplier_create',{supplierName:name,supplierId:s.id,details:`إضافة ${name}`});
        showNotification('تم إضافة '+name, 'success'); playSound('success');
    }
    saveData(); renderSuppliers(); updateSuppliersSelect(); closeSupplierModal();
}

function deleteSupplier(id) {
    const s = suppliers.find(x => x.id === id); if (!s) return;
    if (!confirm(`حذف "${s.name}"؟`)) return;
    const linked = customers.filter(c => c.supplierId == id);
    if (linked.length > 0 && !confirm(`مرتبط بـ ${linked.length} اشتراك. إلغاء الربط؟`)) return;
    customers.forEach(c => { if (c.supplierId == id) c.supplierId = null; });
    suppliers = suppliers.filter(x => x.id !== id);
    logActivity('supplier_delete',{supplierName:s.name,supplierId:id,details:`حذف ${s.name}`});
    saveData(); renderSuppliers(); updateSuppliersSelect(); showNotification('تم الحذف', 'success');
}

function getSupplierStats(sid) {
    const sc = customers.filter(c => c.supplierId == sid);
    const sh = subscriptionHistory.filter(h => h.supplierId == sid);
    const all = [...sc,...sh];
    const orders = all.length;
    const paid = all.reduce((sum,x) => sum+(parseFloat(x.costPrice)||0),0);
    const profit = all.reduce((sum,x) => sum+((parseFloat(x.sellPrice)||0)-(parseFloat(x.costPrice)||0)),0);
    const issues = sc.filter(c => c.notes && ['مشكلة','شكوى','تأخير','خطأ','عطل','مشكله','شكوي'].some(k => c.notes.includes(k))).length;
    return {totalOrders:orders,totalPaid:paid,totalProfit:profit,avgDeliveryDays:0,issues};
}

function showSupplierDetails(sid) {
    const s = suppliers.find(x => x.id === sid); if (!s) return;
    const st = getSupplierStats(sid);
    const sc = customers.filter(c => c.supplierId == sid);
    const sh = subscriptionHistory.filter(h => h.supplierId == sid);
    const all = [...sc,...sh].sort((a,b) => new Date(b.createdAt||b.addedAt)-new Date(a.createdAt||a.addedAt));
    const m = document.getElementById('supplierDetailsModal');
    const c = document.getElementById('supplierDetailsContent');
    document.getElementById('supplierDetailsTitle').textContent = s.name;
    c.innerHTML = `
        <div class="supplier-details-stats">
            <div class="supplier-detail-card"><div class="value orders">${st.totalOrders}</div><div class="label">الطلبات</div></div>
            <div class="supplier-detail-card"><div class="value amount">${st.totalPaid.toLocaleString()} ج.م</div><div class="label">المدفوع</div></div>
            <div class="supplier-detail-card"><div class="value profit">${st.totalProfit.toLocaleString()} ج.م</div><div class="label">الأرباح</div></div>
            <div class="supplier-detail-card"><div class="value issues" style="color:${st.issues>0?'var(--danger)':'var(--success)'}">${st.issues}</div><div class="label">المشاكل</div></div>
        </div>
        <div style="margin-bottom:15px;">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;"><i class="fas fa-phone" style="color:var(--info)"></i><span>${s.phone||'لا يوجد'}</span></div>
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;"><i class="fas fa-circle" style="color:${s.status==='active'?'var(--success)':'var(--gray)'};font-size:10px"></i><span>${s.status==='active'?'نشط':'متوقف'}</span></div>
            ${s.notes?`<div style="color:var(--gray);font-size:14px;padding:10px;background:rgba(255,255,255,0.03);border-radius:10px;"><i class="fas fa-sticky-note" style="margin-left:8px"></i>${s.notes}</div>`:''}
        </div>
        <div style="display:flex;gap:10px;margin-bottom:20px;">
            <button class="btn btn-primary" onclick="openSupplierModal(${s.id});closeSupplierDetailsModal();"><i class="fas fa-edit"></i> تعديل</button>
            <button class="btn btn-danger" onclick="deleteSupplier(${s.id});closeSupplierDetailsModal();"><i class="fas fa-trash"></i> حذف</button>
        </div>
        <div class="card-title" style="margin-bottom:15px;"><i class="fas fa-history" style="color:var(--primary)"></i> آخر العمليات</div>
        ${all.length===0?'<p style="color:var(--gray);text-align:center;padding:20px;">لا توجد عمليات</p>':`
        <table class="supplier-orders-table"><thead><tr><th>العميل</th><th>الخدمة</th><th>شراء</th><th>بيع</th><th>ربح</th><th>التاريخ</th></tr></thead><tbody>
        ${all.slice(0,20).map(o => {
            const p = (parseFloat(o.sellPrice)||0)-(parseFloat(o.costPrice)||0);
            return `<tr><td>${o.name||'غير معروف'}</td><td><span class="service-tag">${o.serviceIcon||'📦'} ${o.serviceName||'-'}</span></td>
            <td>${(parseFloat(o.costPrice)||0).toLocaleString()} ج.م</td><td>${(parseFloat(o.sellPrice)||0).toLocaleString()} ج.م</td>
            <td style="color:${p>=0?'var(--success)':'var(--danger)'}">${p.toLocaleString()} ج.م</td><td>${formatDateArabic(new Date(o.createdAt||o.addedAt))}</td></tr>`;
        }).join('')}</tbody></table>`}`;
    m.classList.add('show');
}
function closeSupplierDetailsModal() { document.getElementById('supplierDetailsModal').classList.remove('show'); }

function renderSuppliers() {
    const c = document.getElementById('suppliersTableContainer');
    const s = document.getElementById('supplierSearch')?.value?.toLowerCase()||'';
    const sf = document.getElementById('supplierStatusFilter')?.value||'all';
    let f = suppliers;
    if (s) f = f.filter(x => x.name.toLowerCase().includes(s) || (x.phone&&x.phone.includes(s)));
    if (sf !== 'all') f = f.filter(x => x.status === sf);
    if (f.length === 0) { c.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🚚</div><div class="empty-state-title">لا يوجد موردين</div><div class="empty-state-text">أضف موردك الأول</div><button class="btn btn-primary" onclick="openSupplierModal()"><i class="fas fa-plus"></i> إضافة</button></div>'; return; }
    c.innerHTML = '<div class="suppliers-grid">' + f.map(s => {
        const st = getSupplierStats(s.id);
        return `<div class="supplier-card ${s.status}" onclick="showSupplierDetails(${s.id})">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;">
                <div class="supplier-icon">🚚</div>
                <div class="action-btns" onclick="event.stopPropagation()">
                    <button class="action-btn edit" onclick="openSupplierModal(${s.id})" title="تعديل"><i class="fas fa-edit"></i></button>
                    <button class="action-btn delete" onclick="deleteSupplier(${s.id})" title="حذف"><i class="fas fa-trash"></i></button>
                </div>
            </div>
            <div class="supplier-name">${s.name}</div>
            ${s.phone?`<div class="supplier-phone"><i class="fas fa-phone"></i> ${s.phone}</div>`:''}
            <div class="supplier-status-badge ${s.status}"><i class="fas fa-circle" style="font-size:8px"></i> ${s.status==='active'?'نشط':'متوقف'}</div>
            <div class="supplier-stats">
                <div class="supplier-stat"><span class="supplier-stat-value">${st.totalOrders}</span><span class="supplier-stat-label">طلب</span></div>
                <div class="supplier-stat"><span class="supplier-stat-value">${st.totalPaid.toLocaleString()}</span><span class="supplier-stat-label">مدفوع</span></div>
                <div class="supplier-stat"><span class="supplier-stat-value" style="color:var(--success)">${st.totalProfit.toLocaleString()}</span><span class="supplier-stat-label">ربح</span></div>
                <div class="supplier-stat"><span class="supplier-stat-value" style="color:${st.issues>0?'var(--danger)':'var(--gray)'}">${st.issues}</span><span class="supplier-stat-label">مشاكل</span></div>
            </div>
        </div>`;
    }).join('') + '</div>';
    const b = document.getElementById('supplierCountBadge');
    if (b) { b.textContent = suppliers.length; b.style.display = suppliers.length>0?'inline-block':'none'; }
}
function filterSuppliers() { renderSuppliers(); }

function updateSuppliersSelect() {
    const sel = document.getElementById('customerSupplier'); if (!sel) return;
    const cv = sel.value;
    sel.innerHTML = '<option value="">اختر المورد</option>';
    suppliers.filter(s => s.status==='active').forEach(s => {
        const o = document.createElement('option'); o.value = s.id; o.textContent = s.name; sel.appendChild(o);
    });
    if (cv) sel.value = cv;
    const msg = document.getElementById('noSuppliersMsg');
    if (msg) msg.style.display = suppliers.length===0?'block':'none';
}
// ===================== CUSTOMER PROFILE (UNIFIED - Feature 1) =====================
function getCustomerStatus(groupId) {
    const all = getGroupSubscriptions(groupId);
    const spent = all.reduce((sum,s) => sum+(parseFloat(s.sellPrice)||0),0);
    const renewals = all.reduce((sum,s) => sum + (s.renewCount||0), 0);
    if (spent > 5000 || all.length >= 5) return 'vip';
    if (all.length <= 1 && !renewals) return 'new';
    return 'regular';
}
function getCustomerStatusLabel(st) { return {vip:'VIP',regular:'عادي',new:'جديد'}[st]||st; }
// موجودة للتوافق مع أي كود قديم بيستخدمها
function getAllCustomerSubscriptions(groupId) { return getGroupSubscriptions(groupId); }

function showCustomerProfile(groupId) {
    const info = getGroupInfo(groupId); if (!info) return;
    const all = info.subs;
    const st = getCustomerStatus(groupId);
    const spent = all.reduce((sum,s) => sum+(parseFloat(s.sellPrice)||0),0);
    const profit = all.reduce((sum,s) => sum+((parseFloat(s.sellPrice)||0)-(parseFloat(s.costPrice)||0)),0);
    const renewals = all.reduce((sum,s) => sum + (s.renewCount||0), 0);
    const avgDur = all.length>0 ? all.reduce((sum,s) => {
        const d = Math.round((new Date(s.endDate)-new Date(s.startDate))/(1000*60*60*24));
        return sum+d;
    },0)/all.length : 0;
    const pc = {}; all.forEach(s => { pc[s.serviceName]=(pc[s.serviceName]||0)+1; });
    const mp = Object.entries(pc).sort((a,b) => b[1]-a[1])[0];
    const sorted = [...all].sort((a,b) => new Date(a.startDate)-new Date(b.startDate));
    const fp = sorted[0], lp = sorted[sorted.length-1];
    const acts = activityLog.filter(a => a.customerId===groupId || a.customerName===info.name);
    const m = document.getElementById('customerProfileModal');
    const cont = document.getElementById('customerProfileContent');
    document.getElementById('customerProfileTitle').textContent = 'ملف العميل: ' + info.name;
    const c = { name: info.name, phone: info.phone, source: info.source };
    cont.innerHTML = `
        <div class="customer-profile-header">
            <div class="customer-profile-avatar ${st}">${c.name.charAt(0)}</div>
            <div class="customer-profile-info">
                <div class="customer-profile-name">${c.name}</div>
                <div class="customer-profile-meta">
                    <div class="customer-profile-phone"><i class="fas fa-phone"></i> ${getSourceIcon(c.source)} ${getSourceName(c.source)}</div>
                    ${c.phone ? `<div class="customer-profile-phone"><i class="fas fa-mobile-alt" style="color:var(--success)"></i> ${c.phone}</div>` : ''}
                    <div class="customer-status-badge${st}"><i class="fas fa-crown" style="font-size:10px"></i> ${getCustomerStatusLabel(st)}</div>
                </div>
            </div>
        </div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:18px;">
            <button class="btn btn-outline" style="font-size:13px;" onclick="openEditProfileModal('${groupId}')"><i class="fas fa-user-edit"></i> تعديل بيانات العميل</button>
            <button class="btn btn-primary" style="font-size:13px;" onclick="startAddSubscriptionFor('${groupId}')"><i class="fas fa-plus"></i> إضافة اشتراك جديد</button>
            <button class="btn btn-outline" style="font-size:13px;color:var(--danger);border-color:var(--danger);" onclick="deleteCustomerGroup('${groupId}')"><i class="fas fa-trash"></i> حذف ملف العميل</button>
        </div>
        <div class="customer-profile-stats">
            <div class="customer-profile-stat"><div class="value subscriptions">${all.length}</div><div class="label">الاشتراكات</div></div>
            <div class="customer-profile-stat"><div class="value renewals">${renewals}</div><div class="label">التجديدات</div></div>
            <div class="customer-profile-stat"><div class="value" style="color:var(--primary)">${spent.toLocaleString()} ج.م</div><div class="label">المدفوع</div></div>
            <div class="customer-profile-stat"><div class="value profit">${profit.toLocaleString()} ج.م</div><div class="label">الأرباح</div></div>
            <div class="customer-profile-stat"><div class="value" style="color:var(--warning)">${Math.round(avgDur)} يوم</div><div class="label">متوسط المدة</div></div>
            <div class="customer-profile-stat"><div class="value" style="color:var(--info)">${mp?mp[0]:'-'}</div><div class="label">أكثر منتج</div></div>
        </div>
        <div class="card" style="margin-bottom:20px;">
            <div class="card-title"><i class="fas fa-info-circle" style="color:var(--primary)"></i> معلومات عامة</div>
            <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:15px;">
                <div><div style="font-size:12px;color:var(--gray);margin-bottom:4px;">أول عملية</div><div style="font-weight:700">${fp?formatDateArabic(new Date(fp.startDate)):'-'}</div></div>
                <div><div style="font-size:12px;color:var(--gray);margin-bottom:4px;">آخر عملية</div><div style="font-weight:700">${lp?formatDateArabic(new Date(lp.startDate)):'-'}</div></div>
            </div>
        </div>
        <div class="card" style="margin-bottom:20px;">
            <div class="card-title"><i class="fas fa-list" style="color:var(--success)"></i> جميع الاشتراكات (${all.length})</div>
            <div class="customer-subscriptions-timeline">
                ${all.length===0?'<p style="color:var(--gray);text-align:center;">لا توجد</p>':[...all].sort((a,b)=>new Date(b.startDate)-new Date(a.startDate)).map(s => {
                    const st2 = getStatus(s);
                    const start = new Date(s.startDate), end = new Date(s.endDate);
                    const dur = Math.round((end-start)/(1000*60*60*24));
                    const p = (parseFloat(s.sellPrice)||0)-(parseFloat(s.costPrice)||0);
                    const sup = suppliers.find(sp => sp.id==s.supplierId);
                    const canRenew = st2.status === 'expired' || st2.status === 'expiring';
                    return `<div class="subscription-timeline-item ${st2.status}">
                        <div class="subscription-timeline-header">
                            <div class="subscription-timeline-service"><span>${s.serviceIcon||'📦'}</span> ${s.serviceName||'-'} ${s.renewCount?`<span style="color:var(--success);font-size:11px"><i class="fas fa-redo"></i> اتجدد ${s.renewCount} مرة</span>`:''}</div>
                            <span class="status-badge ${st2.class}">${st2.text}</span>
                        </div>
                        <div class="subscription-timeline-dates">
                            <div class="field"><span>البداية</span><strong>${formatDateArabic(start)}</strong></div>
                            <div class="field"><span>الانتهاء</span><strong>${formatDateArabic(end)}</strong></div>
                            <div class="field"><span>المدة</span><strong>${dur} يوم</strong></div>
                            <div class="field"><span>الشراء</span><strong>${(parseFloat(s.costPrice)||0).toLocaleString()} ج.م</strong></div>
                            <div class="field"><span>البيع</span><strong>${(parseFloat(s.sellPrice)||0).toLocaleString()} ج.م</strong></div>
                            <div class="field"><span>الربح</span><strong style="color:${p>=0?'var(--success)':'var(--danger)'}">${p.toLocaleString()} ج.م</strong></div>
                            <div class="field"><span>المورد</span><strong>${sup?sup.name:'غير محدد'}</strong></div>
                            <div class="field"><span>الحالة</span><strong>${st2.text}</strong></div>
                        </div>
                        ${s.deliveredEmail || s.deliveredPassword ? `<div style="margin-top:8px;font-size:12px;color:var(--gray);">
                            ${s.deliveredEmail ? `<div style="direction:ltr;text-align:right;"><i class="fas fa-envelope" style="color:var(--primary)"></i> <strong>${s.deliveredEmail}</strong></div>` : ''}
                            ${s.deliveredPassword ? `<div style="direction:ltr;text-align:right;"><i class="fas fa-key" style="color:var(--warning)"></i> <strong>${s.deliveredPassword}</strong></div>` : ''}
                        </div>` : ''}
                        <div class="subscription-timeline-footer" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
                            <span style="color:var(--gray);font-size:13px">الربح: <span class="subscription-profit">${p.toLocaleString()} ج.م</span></span>
                            <div class="action-btns">
                                <button class="action-btn edit" onclick="openEditSubscriptionModal(${s.id})" title="تعديل"><i class="fas fa-edit"></i></button>
                                ${canRenew ? `<button class="action-btn renew" onclick="openRenewalModal('${groupId}', ${s.id})" title="تجديد"><i class="fas fa-sync-alt"></i></button>` : ''}
                                <button class="action-btn delete" onclick="deleteSubscription(${s.id})" title="حذف"><i class="fas fa-trash"></i></button>
                            </div>
                        </div>
                    </div>`;
                }).join('')}
            </div>
        </div>
        <div class="card">
            <div class="card-title"><i class="fas fa-history" style="color:var(--secondary)"></i> سجل العمليات</div>
            <div class="customer-activity-timeline">
                ${acts.length===0?'<p style="color:var(--gray);text-align:center;">لا يوجد</p>':acts.slice(0,20).map(a => `
                    <div class="customer-activity-item ${a.type.split('_')[1]||'create'}">
                        <div style="font-weight:600">${getActivityTypeLabel(a.type)}</div>
                        ${a.serviceName?`<div style="color:var(--gray);font-size:13px"><i class="fas fa-box" style="margin-left:5px"></i>${a.serviceName}</div>`:''}
                        <div class="customer-activity-time"><i class="far fa-clock" style="margin-left:5px"></i>${formatRelativeTime(a.timestamp)}</div>
                    </div>
                `).join('')}
            </div>
        </div>`;
    m.classList.add('show');
}
function closeCustomerProfileModal() { document.getElementById('customerProfileModal').classList.remove('show'); }

// ===================== SORTING: EXPIRY PRIORITY =====================
function sortCustomersByPriority(list) {
    return [...list].sort((a, b) => {
        const sa = getStatus(a).status, sb = getStatus(b).status;
        const p = {expiring:0, active:1, expired:2, completed:3};
        const d = (p[sa] ?? 4) - (p[sb] ?? 4);
        if (d !== 0) return d;
        const ea = new Date(a.endDate), eb = new Date(b.endDate);
        const t = new Date(); t.setHours(0,0,0,0); ea.setHours(0,0,0,0); eb.setHours(0,0,0,0);
        return Math.round((ea-t)/(1000*60*60*24)) - Math.round((eb-t)/(1000*60*60*24));
    });
}

// ===================== ENHANCED RENDERING =====================
function renderDashboard() {
    startTrialWidget();
    document.getElementById('totalCustomers').textContent = customers.length;
    document.getElementById('activeSubscriptions').textContent = customers.filter(c => getStatus(c).status === 'active').length;
    document.getElementById('expiringSoon').textContent = customers.filter(c => getStatus(c).status === 'expiring').length;
    const revenue = customers.reduce((sum,c) => sum+(parseFloat(c.sellPrice)||c.price||0),0);
    document.getElementById('totalRevenue').textContent = revenue.toLocaleString() + ' ج.م';
    document.getElementById('totalSuppliers').textContent = suppliers.length;
    
    // ✅ FIX: عرّف totalCost واستخدم سطر واحد بس
    const totalCost = customers.reduce((sum, c) => sum + (parseFloat(c.costPrice) || 0), 0);
    const totalExp = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    document.getElementById('totalProfit').textContent = (revenue - totalCost - totalExp).toLocaleString() + ' ج.م';
    
    const groups = sortGroupsByPriority(groupCustomerList(customers)).slice(0, 10);
    const container = document.getElementById('recentCustomers');
    if (groups.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">👥</div><div class="empty-state-title">لا يوجد عملاء</div><div class="empty-state-text">ابدأ بإضافة عميل</div><button class="btn btn-primary" onclick="showSection(\'add-customer\')"><i class="fas fa-plus"></i> إضافة</button></div>';
        return;
    }
    container.innerHTML = buildCustomerTable(groups, true) + buildCustomerCards(groups, true);
}

// ===================== CUSTOMER LIST: كل عميل بيظهر مرة واحدة، وكل اشتراكاته مدموجة جواه (Feature 1) =====================
function renderCustomers() {
    const container = document.getElementById('customersTableContainer');
    const search = document.getElementById('customerSearch')?.value?.toLowerCase()||'';
    const statusFilter = document.getElementById('statusFilter')?.value||'all';
    let filtered = customers;
    if (search) filtered = filtered.filter(c => c.name.toLowerCase().includes(search) || c.serviceName.toLowerCase().includes(search));
    if (statusFilter !== 'all') filtered = filtered.filter(c => getStatus(c).status === statusFilter);
    const groups = sortGroupsByPriority(groupCustomerList(filtered));
    if (groups.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📋</div><div class="empty-state-title">لا يوجد عملاء</div><div class="empty-state-text">أضف عميلك الأول</div></div>';
        return;
    }
    const counterHTML = `
        <div style="margin-bottom: 15px; padding: 12px 18px; background: rgba(99,102,241,0.08); border-radius: 14px; border: 1px solid var(--glass-border); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
            <span style="font-weight: 700; color: var(--primary); font-size: 15px;"><i class="fas fa-users"></i> إجمالي العملاء: ${groupCustomerList(customers).length} (${customers.length} اشتراك)</span>
            <span style="color: var(--gray); font-size: 14px; font-weight: 600;">معروض: ${groups.length}</span>
        </div>`;
    container.innerHTML = counterHTML + buildCustomerTable(groups, false) + buildCustomerCards(groups, false);
}

function buildCustomerTable(groups, isDashboard) {
    return `<table class="data-table"><thead><tr><th>العميل</th><th>الخدمة</th>${!isDashboard?'<th>البداية</th>':''}<th>الانتهاء</th>${!isDashboard?'<th>المورد</th>':''}<th>الحالة</th><th>إجراءات</th></tr></thead><tbody>` +
    groups.map(g => {
        const c = g.primary;
        const st = getStatus(c);
        const end = new Date(c.endDate); end.setHours(0,0,0,0);
        const today = new Date(); today.setHours(0,0,0,0);
        const daysLeft = Math.round((end-today)/(1000*60*60*24));
        const isRenewed = c.renewCount > 0;
        const supplier = suppliers.find(s => s.id == c.supplierId);
        const countBadge = g.count > 1 ? `<span style="background:rgba(99,102,241,0.2);color:var(--primary);font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px;margin-right:6px;">×${g.count}</span>` : '';
        const serviceCell = g.count > 1
            ? `<span class="service-tag">${c.serviceIcon} ${c.serviceName}</span> <span style="color:var(--gray);font-size:12px;">+${g.count - 1} أخرى</span>`
            : `<span class="service-tag">${c.serviceIcon} ${c.serviceName}</span>
               ${c.deliveredEmail ? `<div style="font-size:12px;color:var(--primary);margin-top:4px;"><i class="fas fa-envelope" style="margin-left:4px;"></i>${c.deliveredEmail}</div>` : ''}
               ${c.deliveredPassword ? `<div style="font-size:12px;color:var(--warning);margin-top:2px;"><i class="fas fa-key" style="margin-left:4px;"></i>${c.deliveredPassword}</div>` : ''}`;
        return `<tr style="${st.status==='completed'||st.status==='expired'?'opacity:0.6;background:rgba(239,68,68,0.05);':''}">
            <td><div class="customer-info" style="cursor:pointer" onclick="showCustomerProfile('${g.groupId}')"><div class="customer-avatar" style="${isRenewed?'background:linear-gradient(135deg,var(--success),#059669);':''}">${isRenewed?'<i class="fas fa-sync-alt"></i>':g.name.charAt(0)}</div><div><div class="customer-name">${g.name} ${countBadge}${isRenewed?'<span style="color:var(--success);font-size:11px;margin-right:5px"><i class="fas fa-redo"></i></span>':''}</div><div class="customer-source">${getSourceIcon(g.source)} ${getSourceName(g.source)}${g.phone?' · '+g.phone:''}</div></div></div></td>
            <td>${serviceCell}</td>
            ${!isDashboard?`<td>${formatDateArabic(new Date(c.startDate))}</td>`:''}
            <td>${formatDateArabic(new Date(c.endDate))}${daysLeft>0&&st.status!=='completed'?'<br><span style="color:var(--gray);font-size:12px">('+daysLeft+' '+(daysLeft===1?'يوم':'أيام')+')</span>':''}${daysLeft===0&&st.status!=='completed'?'<br><span style="color:var(--warning);font-size:12px">(ينتهي اليوم)</span>':''}${daysLeft<0?'<br><span style="color:var(--danger);font-size:12px">(من '+Math.abs(daysLeft)+')</span>':''}</td>
            ${!isDashboard?`<td>${supplier?supplier.name:'<span style="color:var(--gray)">-</span>'}</td>`:''}
            <td><span class="status-badge ${st.class}">${st.text}</span></td>
            <td><div class="action-btns">
                <button class="action-btn" onclick="showCustomerProfile('${g.groupId}')" title="عرض الملف" style="background:rgba(99,102,241,0.15);color:var(--primary)"><i class="fas fa-eye"></i></button>
                ${g.needsRenewal ? `<button class="action-btn renew" onclick="openRenewalModal('${g.groupId}')" title="تجديد" style="background:rgba(16,185,129,0.3)"><i class="fas fa-redo"></i></button>` : ''}
                <button class="action-btn delete" onclick="deleteCustomerGroup('${g.groupId}')" title="حذف"><i class="fas fa-trash"></i></button>
            </div></td>
        </tr>`;
    }).join('') + '</tbody></table>';
}

function buildCustomerCards(groups, isDashboard) {
    return '<div class="customers-mobile-cards">' + groups.map(g => {
        const c = g.primary;
        const st = getStatus(c);
        const end = new Date(c.endDate); end.setHours(0,0,0,0);
        const today = new Date(); today.setHours(0,0,0,0);
        const daysLeft = Math.round((end-today)/(1000*60*60*24));
        const isRenewed = c.renewCount > 0;
        const supplier = suppliers.find(s => s.id == c.supplierId);
        let dc = 'active', dt = '';
        if (daysLeft > 0) { dt = daysLeft + ' ' + (daysLeft===1?'يوم':'أيام'); }
        else if (daysLeft === 0) { dt = 'ينتهي اليوم!'; dc = 'expiring'; }
        else { dt = 'من ' + Math.abs(daysLeft) + ' ' + (Math.abs(daysLeft)===1?'يوم':'أيام'); dc = 'expired'; }
        const serviceLabel = g.count > 1 ? `${g.count} اشتراكات (آخرها ${c.serviceName})` : c.serviceName;
        return `<div class="customer-mobile-card status-${st.status}" onclick="toggleCard(this,event)" data-customer-id="${g.groupId}">
            <div class="customer-card-header" onclick="event.stopPropagation();showCustomerProfile('${g.groupId}')">
                <div class="customer-card-avatar ${isRenewed?'renewed':''}">${isRenewed?'<i class="fas fa-redo"></i>':g.name.charAt(0)}</div>
                <div class="customer-card-info"><div class="customer-card-name">${g.name}${g.count>1?` <span style="font-size:11px;color:var(--primary);">×${g.count}</span>`:''}${isRenewed?'<span class="renew-badge"><i class="fas fa-redo"></i></span>':''}</div><div class="customer-card-service"><span class="service-icon">${c.serviceIcon}</span>${serviceLabel}</div></div>
                <div class="customer-card-meta"><div class="customer-card-price">${(c.sellPrice||c.price||0).toLocaleString()} ج.م</div><div class="customer-card-status-compact status-${st.status}"><i class="fas fa-circle" style="font-size:6px"></i> ${st.text.split(' ')[0]}</div></div>
            </div>
            <div class="customer-card-expand"><i class="fas fa-chevron-down"></i></div>
            <div class="customer-card-body" onclick="event.stopPropagation()">
                <div class="customer-card-field"><div class="customer-card-label">الحالة</div><div class="customer-card-value days-left ${dc}">${dt}</div></div>
                <div class="customer-card-field"><div class="customer-card-label">المصدر</div><div class="customer-card-value"><span class="customer-card-source-icon">${getSourceIcon(g.source)}</span>${getSourceName(g.source)}</div></div>
                ${g.phone ? `<div class="customer-card-field"><div class="customer-card-label">رقم الهاتف</div><div class="customer-card-value"><i class="fas fa-phone" style="color:var(--success);margin-left:5px;"></i>${g.phone}</div></div>` : ''}
                ${c.deliveredEmail ? `<div class="customer-card-field full-width"><div class="customer-card-label">الإيميل المسلّم</div><div class="customer-card-value" style="color:var(--primary);font-size:13px;direction:ltr;text-align:right;"><i class="fas fa-envelope" style="margin-left:5px;"></i>${c.deliveredEmail}</div></div>` : ''}
                ${c.deliveredPassword ? `<div class="customer-card-field full-width"><div class="customer-card-label">باسورد الإيميل</div><div class="customer-card-value" style="color:var(--warning);font-size:13px;direction:ltr;text-align:right;"><i class="fas fa-key" style="margin-left:5px;"></i>${c.deliveredPassword}</div></div>` : ''}
                <div class="customer-card-field"><div class="customer-card-label">المورد</div><div class="customer-card-value">${supplier?supplier.name:'-'}</div></div>
                <div class="customer-card-field"><div class="customer-card-label">سعر البيع</div><div class="customer-card-value">${(c.sellPrice||c.price||0).toLocaleString()} ج.م</div></div>
                <div class="customer-card-field"><div class="customer-card-label">البداية</div><div class="customer-card-value">${formatDateArabic(new Date(c.startDate))}</div></div>
                <div class="customer-card-field"><div class="customer-card-label">الانتهاء</div><div class="customer-card-value">${formatDateArabic(new Date(c.endDate))}</div></div>
                ${c.notes?`<div class="customer-card-field full-width"><div class="customer-card-label">ملاحظات</div><div class="customer-card-value" style="color:var(--gray);font-size:13px">${c.notes}</div></div>`:''}
            </div>
            <div class="customer-card-footer" onclick="event.stopPropagation()">
                <span class="customer-card-status status-${st.status}"><i class="fas fa-circle" style="font-size:8px"></i> ${st.text}</span>
                <div class="customer-card-actions">
                    <button class="action-btn" onclick="showCustomerProfile('${g.groupId}')" title="عرض الملف" style="background:rgba(99,102,241,0.15);color:var(--primary)"><i class="fas fa-eye"></i></button>
                    ${g.needsRenewal ? `<button class="action-btn renew" onclick="openRenewalModal('${g.groupId}')" title="تجديد"><i class="fas fa-sync-alt"></i></button>` : ''}
                    <button class="action-btn delete" onclick="deleteCustomerGroup('${g.groupId}')" title="حذف"><i class="fas fa-trash"></i></button>
                </div>
            </div>
        </div>`;
    }).join('') + '</div>';
}

// ===================== STOCK (EMAIL/PASSWORD ACCOUNTS) =====================
function openStockModal(sid) {
    const m = document.getElementById('stockModal');
    const t = document.getElementById('stockModalTitle');
    const b = document.getElementById('stockSubmitBtn');
    const idIn = document.getElementById('stockId');
    if (sid) {
        const s = stock.find(x => x.id === sid); if (!s) return;
        t.textContent = 'تعديل حساب'; b.textContent = 'حفظ التعديلات';
        idIn.value = s.id; document.getElementById('stockEmail').value = s.email;
        document.getElementById('stockPassword').value = s.password;
        document.getElementById('stockMaxUsers').value = s.maxUsers;
        document.getElementById('stockNotes').value = s.notes || '';
    } else {
        t.textContent = 'إضافة حساب جديد'; b.textContent = 'إضافة الحساب';
        idIn.value = ''; document.getElementById('stockEmail').value = '';
        document.getElementById('stockPassword').value = '';
        document.getElementById('stockMaxUsers').value = '2';
        document.getElementById('stockNotes').value = '';
    }
    m.classList.add('show');
}
function closeStockModal() { document.getElementById('stockModal').classList.remove('show'); }

function addStock(e) {
    e.preventDefault();
    const id = document.getElementById('stockId').value;
    const email = document.getElementById('stockEmail').value.trim();
    const password = document.getElementById('stockPassword').value;
    const maxUsers = parseInt(document.getElementById('stockMaxUsers').value);
    const notes = document.getElementById('stockNotes').value.trim();
    if (!email || !password) { showNotification('أدخل الإيميل والباسورد', 'warning'); return; }
    if (id) {
        const s = stock.find(x => x.id == id);
        if (s) { s.email = email; s.password = password; s.maxUsers = maxUsers; s.notes = notes; s.updatedAt = new Date().toISOString(); showNotification('تم تعديل الحساب', 'success'); }
    } else {
        const s = { id: Date.now(), email, password, maxUsers, remainingUses: maxUsers, notes, createdAt: new Date().toISOString() };
        stock.push(s);
        showNotification('تم إضافة الحساب: ' + email, 'success'); playSound('success');
    }
    saveData(); renderStock(); updateStockSelect(); closeStockModal();
}

function deleteStock(id) {
    const s = stock.find(x => x.id === id); if (!s) return;
    if (!confirm('حذف الحساب "' + s.email + '"؟')) return;
    stock = stock.filter(x => x.id !== id);
    saveData(); renderStock(); updateStockSelect(); showNotification('تم الحذف', 'success');
}

function getStockStatus(s) {
    if (s.remainingUses <= 0) return { text: 'تم الانتهاء', class: 'status-expired', available: false };
    if (s.remainingUses === 1) return { text: s.remainingUses + ' متبقي', class: 'status-expiring', available: true };
    return { text: s.remainingUses + ' متبقي', class: 'status-active', available: true };
}

function renderStock() {
    const c = document.getElementById('stockTableContainer');
    const s = document.getElementById('stockSearch')?.value?.toLowerCase() || '';
    const sf = document.getElementById('stockStatusFilter')?.value || 'all';
    let f = stock;
    if (s) f = f.filter(x => x.email.toLowerCase().includes(s));
    if (sf !== 'all') {
        f = f.filter(x => {
            const st = getStockStatus(x);
            return sf === 'available' ? st.available : !st.available;
        });
    }
    if (f.length === 0) {
        c.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📧</div><div class="empty-state-title">لا يوجد حسابات</div><div class="empty-state-text">أضف حسابك الأول في المخزن</div><button class="btn btn-primary" onclick="openStockModal()"><i class="fas fa-plus"></i> إضافة</button></div>';
    } else {
        c.innerHTML = '<div class="stock-grid">' + f.map(s => {
            const st = getStockStatus(s);
            const usagePercent = Math.round(((s.maxUsers - s.remainingUses) / s.maxUsers) * 100);
            return `<div class="stock-card ${st.available ? '' : 'finished'}">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;">
                    <div class="stock-icon">📧</div>
                    <div class="action-btns" onclick="event.stopPropagation()">
                        <button class="action-btn edit" onclick="openStockModal(${s.id})" title="تعديل"><i class="fas fa-edit"></i></button>
                        <button class="action-btn delete" onclick="deleteStock(${s.id})" title="حذف"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
                <div class="stock-email">${s.email}</div>
                <div class="stock-password"><i class="fas fa-key"></i> ${s.password}</div>
                <div class="stock-status-badge ${st.class}"><i class="fas fa-circle" style="font-size:8px"></i> ${st.text}</div>
                <div class="stock-progress">
                    <div class="stock-progress-track">
                        <div class="stock-progress-fill" style="width:${usagePercent}%;background:${st.available ? 'var(--success)' : 'var(--danger)'}"></div>
                    </div>
                    <div class="stock-progress-label">${s.maxUsers - s.remainingUses} / ${s.maxUsers} مستخدم</div>
                </div>
                ${s.notes ? `<div style="font-size:12px;color:var(--gray);margin-top:8px;"><i class="fas fa-sticky-note" style="margin-left:5px;"></i>${s.notes}</div>` : ''}
            </div>`;
        }).join('') + '</div>';
    }
    const b = document.getElementById('stockCountBadge');
    if (b) { b.textContent = stock.length; b.style.display = stock.length > 0 ? 'inline-block' : 'none'; }
}
function filterStock() { renderStock(); }

function updateStockSelect() {
    const sel = document.getElementById('customerStockItem');
    if (!sel) return;
    const cv = sel.value;
    sel.innerHTML = '<option value="">اختر حساب من المخزن</option>';
    const available = stock.filter(s => getStockStatus(s).available);
    available.forEach(s => {
        const o = document.createElement('option');
        o.value = s.id;
        o.textContent = s.email + ' (' + s.remainingUses + ' متبقي)';
        sel.appendChild(o);
    });
    if (cv && stock.find(s => s.id == cv && getStockStatus(s).available)) sel.value = cv;
    const msg = document.getElementById('noStockMsg');
    if (msg) msg.style.display = available.length === 0 ? 'block' : 'none';
}

function updateStockPreview() {
    const sid = document.getElementById('customerStockItem').value;
    const preview = document.getElementById('stockPreview');
    if (!sid) { if (preview) preview.style.display = 'none'; return; }
    const s = stock.find(x => x.id == sid);
    if (!s) { if (preview) preview.style.display = 'none'; return; }
    document.getElementById('stockPreviewEmail').textContent = s.email;
    document.getElementById('stockPreviewPassword').textContent = s.password;
    document.getElementById('stockPreviewRemaining').textContent = s.remainingUses;
    preview.style.display = 'block';
}

// ===================== READY MESSAGE =====================
function generateMessage() {
    const name = document.getElementById('customerName').value.trim();
    const serviceSelect = document.getElementById('customerService');
    const serviceId = serviceSelect.value;
    const service = serviceId ? services.find(s => s.id == serviceId) : null;
    const sellPrice = document.getElementById('customerSellPrice').value;
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    const stockId = document.getElementById('customerStockItem').value;

    let deliveredEmail = '';
    let deliveredPassword = '';
    let stockItem = null;

    if (stockId) {
        stockItem = stock.find(s => s.id == stockId);
        if (stockItem) {
            deliveredEmail = stockItem.email;
            deliveredPassword = stockItem.password;
        }
    }

    if (!name || !service) {
        showNotification('⚠️ املأ اسم العميل والخدمة الأول', 'warning');
        return;
    }

    const serviceName = service ? service.name : 'الخدمة';
    const serviceIcon = service ? service.icon : '📦';

    const startArabic = startDate ? formatDateArabic(new Date(startDate)) : '...';
    const endArabic = endDate ? formatDateArabic(new Date(endDate)) : '...';

    let message = `👋 مرحباً ${name}!\n\n`;
    message += `✅ تم استلام المبلغ بنجاح\n`;
    message += `💳 المبلغ: ${sellPrice || '...'} ج.م\n\n`;
    message += `📦 الخدمة: ${serviceIcon} ${serviceName}\n`;
    message += `📅 تاريخ البداية: ${startArabic}\n`;
    message += `📅 تاريخ الانتهاء: ${endArabic}\n`;

    // لو اختار حساب من المخزن → ضيفهم للرسالة
    if (deliveredEmail && deliveredPassword) {
        message += `\n📧 الإيميل: ${deliveredEmail}\n`;
        message += `🔑 الباسورد: ${deliveredPassword}\n`;
        message += `\n⏳ انتظرنا بعض الوقت...\n`;
    }

    message += `\n🙏 شكراً لك!\n`;
    message += `\n📞 للاستفسار: [رقمك هنا]`;

    document.getElementById('readyMessage').value = message;
    showNotification('✅ تم توليد الرسالة!', 'success');
}

function copyMessage() {
    const textarea = document.getElementById('readyMessage');
    if (!textarea.value.trim()) {
        showNotification('⚠️ اضغط "توليد رسالة" الأول', 'warning');
        return;
    }
    
    textarea.select();
    document.execCommand('copy');
    
    showNotification('📋 تم نسخ الرسالة! الصقها في واتساب', 'success');
    playSound('success');
}

function sendViaWhatsApp() {
    const phone = document.getElementById('customerPhone').value.trim();
    const message = document.getElementById('readyMessage').value;
    
    if (!message.trim()) {
        showNotification('⚠️ اضغط "توليد رسالة" الأول', 'warning');
        return;
    }
    
    if (!phone) {
        showNotification('⚠️ اكتب رقم الهاتف الأول', 'warning');
        return;
    }
    
    // تنظيف الرقم
    const cleanPhone = phone.replace(/^0/, '20').replace(/[^0-9]/g, '');
    const encodedMessage = encodeURIComponent(message);
    
    // فتح واتساب ويب مع الرسالة جاهزة
    window.open(`https://wa.me/${cleanPhone}?text=${encodedMessage}`, '_blank');
    
    showNotification('📱 تم فتح واتساب مع الرسالة جاهزة!', 'success');
}

// ===================== ACTIVATION FROM SETTINGS =====================
function activateFromSettings() {
    const inputs = document.querySelectorAll('.settings-code-digit');
    let code = '';
    inputs.forEach(input => {
        code += input.value.toUpperCase();
    });
    
    const errorEl = document.getElementById('settingsActivationError');
    
    if (code.length !== CODE_LENGTH) {
        if (errorEl) {
            errorEl.textContent = '⚠️ أكمل الـ 6 خانات';
            errorEl.style.display = 'block';
        }
        return;
    }
    
    if (!isValidActivationCode(code)) {
        if (errorEl) {
            errorEl.textContent = '⚠️ الكود غير صالح. الصيغة: حرفين + 4 أرقام';
            errorEl.style.display = 'block';
        }
        playSound('alert');
        return;
    }
    
    // Activate the device permanently
    localStorage.setItem(ACTIVATED_KEY, 'true');
    updateDeviceActivationStatus();
    
    if (errorEl) errorEl.style.display = 'none';
    inputs.forEach(input => {
        input.value = '';
        input.classList.remove('filled');
    });
    
    showNotification('✅ تم التفعيل بنجاح! الموقع مفتوح لك دايماً', 'success');
    playSound('success');
    
    // Update UI immediately
    startTrialWidget();
    
    // If lock screen is showing, hide it
    hideLockScreen();
}

// ===================== EXCEL EXPORT =====================
function exportCustomersToExcel() {
    if (customers.length === 0) {
        showNotification('⚠️ مفيش عملاء للتصدير', 'warning');
        return;
    }
    
    const data = customers.map(c => {
        const st = getStatus(c);
        const supplier = suppliers.find(s => s.id == c.supplierId);
        return {
            'اسم العميل': c.name,
            'المصدر': getSourceName(c.source),
            'الخدمة': c.serviceName,
            'سعر الشراء (ج.م)': c.costPrice || 0,
            'سعر البيع (ج.م)': c.sellPrice || c.price || 0,
            'الربح (ج.م)': (parseFloat(c.sellPrice || c.price || 0) - parseFloat(c.costPrice || 0)),
            'المورد': supplier ? supplier.name : '-',
            'تاريخ البداية': c.startDate,
            'تاريخ الانتهاء': c.endDate,
            'الحالة': st.text,
            'رقم الهاتف': c.phone || '',
            'الإيميل المسلم': c.deliveredEmail || '',
            'باسورد الإيميل': c.deliveredPassword || '',
            'ملاحظات': c.notes || ''
        };
    });
    
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'العملاء');
    XLSX.writeFile(wb, 'Stack_CRM_Customers.xlsx');
    
    showNotification('✅ تم تحميل ملف العملاء!', 'success');
    playSound('success');
}

function exportSuppliersToExcel() {
    if (suppliers.length === 0) {
        showNotification('⚠️ مفيش موردين للتصدير', 'warning');
        return;
    }
    
    const data = suppliers.map(s => {
        const st = getSupplierStats(s.id);
        return {
            'اسم المورد': s.name,
            'الهاتف': s.phone || '-',
            'الحالة': s.status === 'active' ? 'نشط' : 'متوقف',
            'عدد الطلبات': st.totalOrders,
            'إجمالي المدفوع (ج.م)': st.totalPaid,
            'إجمالي الأرباح (ج.م)': st.totalProfit,
            'المشاكل': st.issues,
            'ملاحظات': s.notes || ''
        };
    });
    
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'الموردين');
    XLSX.writeFile(wb, 'Stack_CRM_Suppliers.xlsx');
    
    showNotification('✅ تم تحميل ملف الموردين!', 'success');
    playSound('success');
}

function exportStockToExcel() {
    if (stock.length === 0) {
        showNotification('⚠️ مفيش حسابات للتصدير', 'warning');
        return;
    }
    const data = stock.map(s => {
        const st = getStockStatus(s);
        return {
            'الإيميل': s.email,
            'الباسورد': s.password,
            'عدد المستخدمين': s.maxUsers,
            'المتبقي': s.remainingUses,
            'الحالة': st.text,
            'ملاحظات': s.notes || ''
        };
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'المخزن');
    XLSX.writeFile(wb, 'Stack_CRM_Stock.xlsx');
    showNotification('✅ تم تحميل ملف المخزن!', 'success');
    playSound('success');
}

function exportFinanceToExcel() {
    const revenue = customers.reduce((sum, c) => sum + (parseFloat(c.sellPrice || c.price || 0)), 0);
    const totalCost = customers.reduce((sum, c) => sum + (parseFloat(c.costPrice || 0)), 0);
    const totalExp = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const netProfit = revenue - totalCost - totalExp;
    
    const summaryData = [{
        'البند': 'إجمالي الإيرادات',
        'المبلغ (ج.م)': revenue
    }, {
        'البند': 'إجمالي تكلفة الشراء',
        'المبلغ (ج.م)': totalCost
    }, {
        'البند': 'إجمالي المصروفات',
        'المبلغ (ج.م)': totalExp
    }, {
        'البند': 'صافي الربح',
        'المبلغ (ج.م)': netProfit
    }];
    
    const expensesData = expenses.length ? expenses.map(e => ({
        'الخدمة': e.serviceName,
        'الوصف': e.desc,
        'المبلغ (ج.م)': e.amount,
        'التاريخ': e.date,
        'ملاحظات': e.notes || ''
    })) : [{'ملاحظة': 'لا توجد مصروفات'}];
    
    const wb = XLSX.utils.book_new();
    const ws1 = XLSX.utils.json_to_sheet(summaryData);
    const ws2 = XLSX.utils.json_to_sheet(expensesData);
    
    XLSX.utils.book_append_sheet(wb, ws1, 'الملخص المالي');
    XLSX.utils.book_append_sheet(wb, ws2, 'المصروفات');
    XLSX.writeFile(wb, 'Stack_CRM_Finance.xlsx');
    
    showNotification('✅ تم تحميل ملف المالية!', 'success');
    playSound('success');
}

// ===================== DATA TRANSFER (NO SERVER) =====================
// ===================== DATA TRANSFER (LZ-String + File) =====================
function exportAllData() {
    const exportArea = document.getElementById('exportDataArea');
    const copyBtn = document.getElementById('copyExportBtn');
    if (!exportArea || !copyBtn) return;

    try {
        const data = {};
        const keys = [
            'sub_customers', 'sub_services', 'sub_expenses', 'sub_suppliers',
            'sub_stock', 'sub_activity_log', 'sub_subscription_history', 'sub_settings',
            'sub_merchant_name', 'sub_sound', 'sub_push_enabled',
            'sub_dismissed_notifications', 'sub_played_sounds',
            'sub_trial_start', 'sub_activated', 'sub_admin_secret'
        ];
        keys.forEach(key => {
            const value = localStorage.getItem(key);
            if (value !== null) data[key] = value;
        });

        if (Object.keys(data).length === 0) {
            showNotification('⚠️ مفيش بيانات للتصدير', 'warning');
            return;
        }

        // ✅ LZ-String ضغط أقوى من Base64 بكتير
        const jsonStr = JSON.stringify(data);
        const compressed = LZString.compressToEncodedURIComponent(jsonStr);

        exportArea.value = compressed;
        exportArea.style.display = 'block';
        copyBtn.style.display = 'block';

        showNotification('✅ تم الضغط! الحجم: ' + compressed.length + ' حرف (أصغر بكتير من قبل)', 'success');
        playSound('success');
        exportArea.select();

    } catch (err) {
        console.error('Export error:', err);
        showNotification('❌ حصل خطأ في التصدير', 'danger');
    }
}

function copyExportCode() {
    const exportArea = document.getElementById('exportDataArea');
    if (!exportArea || !exportArea.value) {
        showNotification('⚠️ مفيش كود للنسخ', 'warning');
        return;
    }
    exportArea.select();
    document.execCommand('copy');
    showNotification('📋 تم نسخ الكود المضغوط!', 'success');
    playSound('success');
}

function importAllData() {
    const importArea = document.getElementById('importDataArea');
    const statusEl = document.getElementById('importStatus');

    if (!importArea || !importArea.value.trim()) {
        showNotification('⚠️ الصق الكود الأول', 'warning');
        return;
    }

    try {
        const compressed = importArea.value.trim();
        let jsonStr = null;

        // ✅ جرب LZ-String الأول
        if (typeof LZString !== 'undefined') {
            jsonStr = LZString.decompressFromEncodedURIComponent(compressed);
        }

        // ✅ لو فشل، جرب الطريقة القديمة (Base64) للتوافقية
        if (!jsonStr) {
            jsonStr = decodeURIComponent(escape(atob(compressed)));
        }

        const data = JSON.parse(jsonStr);
        if (!data || typeof data !== 'object') throw new Error('Invalid format');

        const keysCount = Object.keys(data).length;
        if (keysCount === 0) {
            showNotification('⚠️ الكود فاضي', 'warning');
            return;
        }

        if (!confirm('⚠️ هيتم استبدال كل البيانات الحالية. متأكد؟')) return;

        Object.entries(data).forEach(([key, value]) => {
            localStorage.setItem(key, value);
        });

        if (statusEl) {
            statusEl.textContent = '✅ تم استيراد ' + keysCount + ' عناصر! جاري التحديث...';
            statusEl.style.color = 'var(--success)';
            statusEl.style.display = 'block';
        }
        showNotification('✅ تم الاستيراد! الصفحة هتتحدث...', 'success');
        playSound('success');
        setTimeout(() => location.reload(), 1500);

    } catch (err) {
        console.error('Import error:', err);
        if (statusEl) {
            statusEl.textContent = '❌ الكود غير صحيح أو تالف!';
            statusEl.style.color = 'var(--danger)';
            statusEl.style.display = 'block';
        }
        showNotification('❌ الكود غير صحيح! تأكد من نسخه كامل', 'danger');
        playSound('alert');
    }
}

// ✅ تصدير/استيراب الملف (أسهل للبيانات الكبيرة)
function exportToFile() {
    const data = {};
    const keys = [
        'sub_customers', 'sub_services', 'sub_expenses', 'sub_suppliers',
        'sub_stock', 'sub_activity_log', 'sub_subscription_history',
        'sub_settings', 'sub_merchant_name', 'sub_admin_secret'
    ];
    keys.forEach(key => {
        const v = localStorage.getItem(key);
        if (v !== null) data[key] = v;
    });

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tamm_backup_' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showNotification('✅ تم تحميل ملف النسخ الاحتياطي', 'success');
    playSound('success');
}

function importFromFile(input) {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            if (!data || typeof data !== 'object') throw new Error('Invalid file');

            if (!confirm('⚠️ هيتم استبدال كل البيانات الحالية بالملف الجديد. متأكد؟')) return;

            Object.entries(data).forEach(([key, value]) => {
                localStorage.setItem(key, value);
            });

            showNotification('✅ تم استيراد الملف! جاري التحديث...', 'success');
            playSound('success');
            setTimeout(() => location.reload(), 1500);

        } catch (err) {
            showNotification('❌ الملف غير صالح أو تالف', 'danger');
            playSound('alert');
        }
    };
    reader.readAsText(file);
    input.value = ''; // reset
}

function copyExportCode() {
    const exportArea = document.getElementById('exportDataArea');
    if (!exportArea || !exportArea.value) {
        showNotification('⚠️ مفيش كود للنسخ', 'warning');
        return;
    }

    exportArea.select();
    document.execCommand('copy');

    showNotification('📋 تم نسخ الكود! الصقه في الجهاز التاني', 'success');
    playSound('success');
}

function importAllData() {
    const importArea = document.getElementById('importDataArea');
    const statusEl = document.getElementById('importStatus');

    if (!importArea || !importArea.value.trim()) {
        showNotification('⚠️ الصق كود البيانات الأول', 'warning');
        return;
    }

    try {
        const compressed = importArea.value.trim();
        const jsonStr = decodeURIComponent(escape(atob(compressed)));
        const data = JSON.parse(jsonStr);

        if (!data || typeof data !== 'object') {
            throw new Error('Invalid data format');
        }

        const keysCount = Object.keys(data).length;
        if (keysCount === 0) {
            showNotification('⚠️ الكود فاضي', 'warning');
            return;
        }

        // Confirm before overwriting
        if (!confirm('⚠️ هيتم استبدال كل البيانات الحالية بالبيانات الجديدة. متأكد؟')) {
            return;
        }

        // Write to localStorage
        Object.entries(data).forEach(([key, value]) => {
            localStorage.setItem(key, value);
        });

        // Update UI feedback
        if (statusEl) {
            statusEl.textContent = '✅ تم استيراد ' + keysCount + ' عناصر بنجاح! جاري تحديث الصفحة...';
            statusEl.style.color = 'var(--success)';
            statusEl.style.display = 'block';
        }

        showNotification('✅ تم استيراد البيانات بنجاح! الصفحة هتتحدث دلوقتي', 'success');
        playSound('success');

        // Reload after short delay to apply new data
        setTimeout(() => {
            location.reload();
        }, 2000);

    } catch (err) {
        console.error('Import error:', err);
        if (statusEl) {
            statusEl.textContent = '❌ الكود غير صحيح أو تالف! تأكد إنك نسخت الكود كامل';
            statusEl.style.color = 'var(--danger)';
            statusEl.style.display = 'block';
        }
        showNotification('❌ الكود غير صحيح! تأكد من نسخه كامل', 'danger');
        playSound('alert');
    }
}