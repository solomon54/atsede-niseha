// Import the functions you need from the SDKs you need
import { getAnalytics } from "firebase/analytics";
import { initializeApp } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAug-K9V11-4bMiiyfxw1O3crhClDViWJI",
  authDomain: "atsede-niseha.firebaseapp.com",
  projectId: "atsede-niseha",
  storageBucket: "atsede-niseha.firebasestorage.app",
  messagingSenderId: "543261831846",
  appId: "1:543261831846:web:417d137a61c2d9ce677a67",
  measurementId: "G-ZZMX1JVERV",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
