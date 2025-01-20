import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: 'AIzaSyCqJHvQNkag5lkz0VQ5wMWQZBVcucQOnLw',
  authDomain: 'survey-494f4.firebaseapp.com',
  projectId: 'survey-494f4',
  storageBucket: 'survey-494f4.firebasestorage.app',
  messagingSenderId: '920634881212',
  appId: '1:920634881212:web:13b247825c5e4713754cb9',
  databaseURL:
    'https://survey-494f4-default-rtdb.asia-southeast1.firebasedatabase.app'
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

export { db };
