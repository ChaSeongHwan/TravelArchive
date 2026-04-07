/**
 * account.js
 */

import { Icons } from './assets.js';
import { renderTemplate } from './utils.js';
import { BackendHooks } from './api.js';

export function renderAccountPage(container) {
  container.innerHTML = renderTemplate('account', {}, Icons);

  const loginBtn = document.getElementById('loginBtn');
  const loginIdInput = document.getElementById('loginId');
  const loginPwInput = document.getElementById('loginPw');

  const handleLogin = async () => {
    const id = loginIdInput.value;
    const pw = loginPwInput.value;
    if (id && pw) {
      try {
        const res = await BackendHooks.login(id, pw);
        alert(`${res.message || `${id}님, 환영합니다!`}`);
      } catch (e) {
        alert('로그인에 실패했습니다.');
      }
    }
    else if (!id) { alert('아이디를 입력해주세요.'); loginIdInput.focus(); }
    else { alert('비밀번호를 입력해주세요.'); loginPwInput.focus(); }
  };

  if (loginIdInput) loginIdInput.addEventListener('keydown', (e) => e.key === 'Enter' && handleLogin());
  if (loginPwInput) loginPwInput.addEventListener('keydown', (e) => e.key === 'Enter' && handleLogin());
  if (loginBtn) loginBtn.addEventListener('click', handleLogin);

  const guestBtn = document.getElementById('guestLoginBtn');
  if (guestBtn) guestBtn.addEventListener('click', async () => {
    try {
      const res = await BackendHooks.guestLogin();
      alert(res.message || '게스트로 로그인되었습니다.');
    } catch (e) {
      alert('게스트 로그인에 실패했습니다.');
    }
  });

  ['google', 'kakao', 'naver'].forEach(provider => {
    const btn = document.getElementById(`${provider}LoginBtn`);
    if (btn) btn.addEventListener('click', async () => {
      try {
        const res = await BackendHooks.socialLogin(provider);
        alert(res.message || `${provider} 로그인 성공`);
      } catch (e) {
        alert(`${provider} 연동에 실패했습니다.`);
      }
    });
  });

  const signUpBtn = document.getElementById('signUpBtn');
  if (signUpBtn) signUpBtn.addEventListener('click', async () => {
    try {
      const res = await BackendHooks.signUp({ intent: true });
      alert(res.message || '회원가입 프로세스 시작');
    } catch (e) {
      alert('회원가입 요청에 실패했습니다.');
    }
  });

  const findBtn = document.getElementById('findAccountBtn');
  if (findBtn) findBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    try {
      const res = await BackendHooks.findAccount();
      alert(res.message || '계정 찾기 프로세스 시작');
    } catch (e) {
      alert('계정 찾기 요청에 실패했습니다.');
    }
  });
}
