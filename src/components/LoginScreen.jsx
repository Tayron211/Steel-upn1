import React, { useState } from 'react';
import { 
  ShieldCheck, 
  User, 
  Lock, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  AlertCircle
} from 'lucide-react';
import { authenticate, USERS_REGISTRY } from '../utils/auth';

/**
 * Logotipo oficial vectorial UPN (Escudo Norte UPN)
 */
export const UpnBrandLogo = ({ size = 22, color = '#FFB800' }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill={color} 
    xmlns="http://www.w3.org/2000/svg"
    style={{ display: 'block', flexShrink: 0 }}
  >
    <path d="M11.4 2.5H9.4L4 7.9V11.1L8.55 7.9V22H11.4V2.5Z" />
    <path d="M12.6 2.5H14.6L20 7.9V11.1L15.45 7.9V22H12.6V2.5Z" />
  </svg>
);

export default function LoginScreen({ onLogin }) {
  const [usernameInput, setUsernameInput] = useState('tsalinas');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Detección inteligente del rol y nombre según lo que escribe el usuario
  const trimmedUser = usernameInput.trim().toLowerCase();
  const matchedUser = USERS_REGISTRY.find(u => 
    u.username.toLowerCase() === trimmedUser || 
    u.name.toLowerCase() === trimmedUser
  );

  const detectedRole = (
    matchedUser?.role === 'admin' ||
    trimmedUser.includes('admin') || 
    trimmedUser === 'root' || 
    trimmedUser === 'tsalinas' ||
    trimmedUser === 'tayron'
  ) ? 'admin' : 'asistente';

  const detectedDisplayName = matchedUser 
    ? matchedUser.name 
    : (trimmedUser ? trimmedUser.toUpperCase() : 'USUARIO');

  const handleSubmit = (e) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsSubmitting(true);

    const result = authenticate(usernameInput, password);

    if (result.success) {
      setTimeout(() => {
        setIsSubmitting(false);
        if (onLogin) onLogin(result.user);
      }, 200);
    } else {
      setTimeout(() => {
        setIsSubmitting(false);
        setErrorMsg(result.message || 'Contraseña incorrecta. Verifica tus credenciales.');
      }, 200);
    }
  };

  return (
    <div className="login-screen-wrapper">
      <div className="login-card-container">
        
        {/* PANEL IZQUIERDO: BRANDING INSTITUCIONAL UPN CON FONDO ARTÍSTICO Y MALLA */}
        <div className="login-visual-panel">
          {/* Malla de círculos y guías tecnológicas */}
          <div className="login-visual-mesh-bg">
            <svg 
              width="100%" 
              height="100%" 
              viewBox="0 0 400 500" 
              fill="none" 
              xmlns="http://www.w3.org/2000/svg" 
              style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0.14, pointerEvents: 'none' }}
            >
              <circle cx="200" cy="220" r="160" stroke="#FFB800" strokeWidth="1" strokeDasharray="4 8" />
              <circle cx="200" cy="220" r="110" stroke="#FFB800" strokeWidth="1.5" strokeOpacity="0.4" />
              <circle cx="200" cy="220" r="60" stroke="#FFB800" strokeWidth="1" strokeDasharray="3 6" />
              <path d="M40 220 H360 M200 60 V380" stroke="rgba(255,184,0,0.18)" strokeWidth="1" />
            </svg>
          </div>

          <div className="login-visual-content">
            {/* Tag superior de branding */}
            <div className="login-badge-tag">
              <UpnBrandLogo size={15} color="#FFB800" />
              <span>UNIVERSIDAD PRIVADA DEL NORTE</span>
            </div>

            {/* Emblema central de marca UPN con halo sutil */}
            <div className="login-brand-monogram-box">
              <div className="login-brand-halo" />
              <div className="login-brand-icon-wrapper">
                <UpnBrandLogo size={78} color="#FFB800" />
              </div>
            </div>

            {/* Titular e identidad institucional del proyecto */}
            <div className="login-visual-hero">
              <div className="login-visual-title">
                <span className="login-title-white">Portal Corporativo de</span>
                <span className="text-gradient-upn">Control Docente & Operaciones</span>
              </div>
              <div className="login-visual-subtitle">
                Sistema de Control de Asistencia y Operaciones • Campus Comas
              </div>
            </div>
          </div>
        </div>

        {/* PANEL DERECHO: FORMULARIO LIMPIO CON DETECCIÓN INTELIGENTE DE ROL */}
        <div className="login-form-panel">
          {/* Encabezado con Logotipo UPN */}
          <div className="login-form-header">
            <div className="login-brand-emblem">
              <UpnBrandLogo size={32} color="#FFB800" />
            </div>
            <h2 className="login-form-title">Iniciar Sesión</h2>
            <p className="login-form-subtitle">
              Control Docente • Campus Comas
            </p>
          </div>

          {/* Formulario */}
          <form onSubmit={handleSubmit} className="login-form-body">
            
            {/* Campo: Usuario con Detección Automática de Rol */}
            <div className="login-input-group">
              <div className="login-label-row">
                <label className="login-label" htmlFor="login-username">
                  Usuario del Sistema
                </label>
                {/* Indicador inteligente de rol detectado automáticamente */}
                <span className={`login-detected-badge ${detectedRole === 'admin' ? 'admin' : 'user'}`}>
                  {detectedRole === 'admin' ? (
                    <>
                      <ShieldCheck size={12} />
                      <span>Modo Administrador</span>
                    </>
                  ) : (
                    <>
                      <User size={12} />
                      <span>Modo Asistente</span>
                    </>
                  )}
                </span>
              </div>
              <div className="login-input-wrapper">
                <div className="login-input-icon">
                  {detectedRole === 'admin' ? (
                    <ShieldCheck size={18} color="#FFB800" />
                  ) : (
                    <User size={18} color="#0284c7" />
                  )}
                </div>
                <input
                  id="login-username"
                  type="text"
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  placeholder="ej: tsalinas, apalomino, apascual..."
                  required
                  className="login-input"
                  style={{ paddingLeft: '52px', paddingRight: '16px' }}
                  autoComplete="username"
                  autoFocus
                />
              </div>
              {matchedUser && (
                <div className="text-[11px] font-bold text-slate-500 mt-1 pl-1 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span>Asistente: <strong className="text-slate-800 dark:text-zinc-200">{detectedDisplayName}</strong></span>
                </div>
              )}
            </div>

            {/* Campo: Contraseña */}
            <div className="login-input-group">
              <div className="login-label-row">
                <label className="login-label" htmlFor="login-password">
                  Contraseña de Acceso
                </label>
              </div>
              <div className="login-input-wrapper">
                <div className="login-input-icon">
                  <Lock size={18} color="#94a3b8" />
                </div>
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errorMsg) setErrorMsg(null);
                  }}
                  placeholder="••••••••••••"
                  required
                  className="login-input"
                  style={{ paddingLeft: '52px', paddingRight: '48px' }}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="login-password-toggle"
                  title={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <p className="text-[10px] text-slate-400 mt-1 pl-1">
                Tip: PIN simple (1234) o tu apellido en minúsculas.
              </p>
            </div>

            {/* Alerta de Error si las credenciales fallan */}
            {errorMsg && (
              <div className="login-error-banner animate-shake">
                <AlertCircle size={15} style={{ flexShrink: 0 }} />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Botón Principal de Acceso */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="login-submit-btn"
            >
              <span>{isSubmitting ? 'Verificando acceso...' : 'Ingresar al Portal'}</span>
              <ArrowRight size={17} />
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}
