/**
 * Firebase 설정 파일
 * Firebase 콘솔(https://console.firebase.google.com)에서
 * 프로젝트 설정 > 앱 추가 > 웹 앱 등록 후 아래 값을 교체하세요.
 */
const FIREBASE_CONFIG = {
    apiKey:            "YOUR_API_KEY",
    authDomain:        "YOUR_PROJECT.firebaseapp.com",
    projectId:         "YOUR_PROJECT_ID",
    storageBucket:     "YOUR_PROJECT.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId:             "YOUR_APP_ID"
};

// Firebase 초기화 (중복 초기화 방지)
if (!firebase.apps.length) {
    firebase.initializeApp(FIREBASE_CONFIG);
}

const auth = firebase.auth();
const db   = firebase.firestore();

// Firebase 미설정 여부 확인 (데모 모드)
const IS_DEMO_MODE = FIREBASE_CONFIG.apiKey === "YOUR_API_KEY";

if (IS_DEMO_MODE) {
    console.warn("[데모 모드] assets/js/firebase-config.js에 Firebase 설정을 입력하면 실제 데이터베이스와 연동됩니다.");
}
