// Firebase 프로젝트 설정값을 아래에 입력하세요.
// Firebase Console(https://console.firebase.google.com) > 프로젝트 설정 > 내 앱 에서 확인
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "program-tool.firebaseapp.com",
  projectId: "program-tool",
  storageBucket: "program-tool.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const googleProvider = new firebase.auth.GoogleAuthProvider();
