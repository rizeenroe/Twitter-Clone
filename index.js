const express = require('express');
const path = require('path');
const bcrypt = require('bcryptjs')
const session = require('express-session')
require('dotenv').config();

const app = express();
const PORT = 8000;

// Firebase configuration
const admin = require('firebase-admin');
const firebase = require('firebase/app');
const serviceAccount = JSON.parse(process.env.FIREBASEKEY);
const { log } = require('console');
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
});
require('firebase/firestore'); 
const db = admin.firestore();


//express-session set up
app.use(session({
    secret: 'yourSecretKey',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // For non-HTTPS
}));

app.use((req, res, next) => {
    console.log(`Session ID: ${req.session.id}`);
    res.locals.user = req.session.user || null
    next()
})


  
//express server middleware
app.use(express.json());
app.use(express.urlencoded({ extende: true }))

//ejs set up
app.set('view engine', 'ejs')
app.set('views', path.join(__dirname, 'views'));

//css path
app.use(express.static(path.join(__dirname, 'public'))); 


//pages
app.get('/', (req, res) => {
    console.log(req.session.user);

    if (req.session.user) {
        res.render('home.ejs', {username: req.session.user.userName})
    }else{
        res.render('home.ejs', {username: "guest"})
    }
});

app.get('/page1', (req, res) => {
    res.render('page1.ejs')
})


//regiter, login, and logout
app.get('/register', (req, res) => {
    res.render('register')
})

app.post('/register', async (req, res) => {
    const { email, password, name, age } = req.body;    
    
    if (!email || !password || !name || !age) {
        return res.status(400).send('All fields are required');
    }
    
    try {
        const existingUserSnapshot = await db.collection('users').where('email', '==', email).get();

        if (!existingUserSnapshot.empty) {
            return res.status(400).send('Email is already registered');
        }

        const userRef = db.collection('users').doc();
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        
        await userRef.set({
            email: email,
            password: hashedPassword,
            name: name,
            age: age,
            createdAt: admin.firestore.FieldValue.serverTimestamp(), // Timestamp for record creation

        }) 
        res.status(200).send('User added successfully');
    
    } catch (error) {
        res.status(500).send('Error adding user: ' + error.message);
    }
});

app.get('/login', (req, res) => {
    res.render('login')
})

app.post('/login', async (req, res) => {
    const {email, password} = req.body;
    
    try {
        const userDoc = await admin.firestore().collection('users').where('email', '==', email).get();
        if (userDoc.empty) {
            return res.status(401).send('Invalid Credentials')
        }   
        const userData = userDoc.docs[0].data()
        const storedHashedPassword = userData.password
        const passwordMatch = await bcrypt.compare(password, storedHashedPassword)
        
        if (passwordMatch) {
            req.session.user = {email: email, userName: userData.name || 'Guest'}
            // res.send('User Logged In')
            console.log(`User logged in successfully: ${email}`);

            res.redirect('/')
        }else{
            res.status(401).send('Invalid credentials');
        }

    } catch (error) {
        res.status(500).send('Error during login');
        console.error('Error checking user credentials:', error);
    }
})

app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
          return res.send('Failed to log out');
        }
        res.redirect('/')
    });
})





app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    
})