const express = require('express');
const path = require('path');
const bcrypt = require('bcryptjs')
const session = require('express-session')
require('dotenv').config();

const app = express();
const PORT = 8000;

// Firebase configuration
const admin = require('firebase-admin');
const { log } = require('console');
const serviceAccount = JSON.parse(process.env.FIREBASEKEY);
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
});
require('firebase/firestore'); 
const db = admin.firestore();

//express-session set up
app.use(session({
    secret: 'yourSecretKey',
    resave: true,
    saveUninitialized: true,
    cookie: { 
        secure: true 
    } 
}));

app.use((req, res, next) => {
    console.log(`Session ID: ${req.session.id}`);
    res.locals.user = req.session.user || null
    next()
})
  
//express server middlewares
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.urlencoded({ extende: true }))
//this middleware is to be able to hide some elements when in a certain route
app.use((req, res, next)=> {
    res.locals.currentRoute = req.path; 
    next();
})


//ejs set up
app.set('view engine', 'ejs')
app.set('views', path.join(__dirname, 'views'));

//css path
app.use(express.static(path.join(__dirname, 'public'))); 


//pages
app.get('/', async (req, res) => {
    console.log(req.session.user);

    try {
        const snapshot = await db.collection('posts').orderBy("createdAt", "desc").get();
        const posts = snapshot.docs.map((doc) => { 
            const data = doc.data();
            return { 
                id: doc.id, 
                ...data, 
                createdAt: data.createdAt.toDate()
            }
        });

        res.render('home.ejs', { 
            name: req.session.user ? req.session.user.name : "guest",
            posts
        });
    } catch (error) {
        console.error("Error fetching posts:", error);
        res.status(500).send("Error fetching posts");
    }
});



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
            email: email.toLowerCase(),
            password: hashedPassword,
            name: name,
            age: age,
            verified: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(), // Timestamp for record creation

        }) 
        // res.status(200).send('User added successfully');
        res.redirect("/login")
    
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
        const userDoc = await admin.firestore().collection('users').where('email', '==', email.toLowerCase()).get();
        if (userDoc.empty) {
            return res.status(401).send('Invalid Credentials')
        }   
        const userData = userDoc.docs[0].data()
        const storedHashedPassword = userData.password
        const passwordMatch = await bcrypt.compare(password, storedHashedPassword)
        
        if (passwordMatch) {
            req.session.user = {email: email.toLowerCase(), name: userData.name || 'Guest', age: userData.age, verified: userData.verified}
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


//pages POST functions
app.post('/', async (req, res) => {
    if (req.session.user) {
        const message = req.body.message;
        const name =  req.session.user.name;
        const verified = req.session.user.verified;
        
        try {
            const userRef = db.collection('posts').doc();
            
            await userRef.set({
                name: name,
                verified: verified,
                message: message,
                likes: 0,
                comments: 0,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            
            res.redirect('/')
        } catch (error) {
            console.error('Error posting message:', error);
            res.status(500).send('Error posting message');
        }
    } else {
        res.redirect('/login');
    }
});







app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    
})