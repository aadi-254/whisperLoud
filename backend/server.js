const express = require('express')
const router = express.Router();;
const http = require("http");
const session = require('express-session');
const crypto = require('crypto');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcrypt');
require('dotenv').config();
const multer = require('multer');
const app = express();
const cron = require('node-cron');
const PORT = process.env.PORT || 3000
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const cors = require('cors'); // To allow cross-origin requests


// Middleware to parse URL-encoded data
app.use(express.urlencoded({ extended: false }));
app.use(cors()); // Enable CORS
app.use(express.json()); // Parse JSON bodies

app.use(session({
    secret: 'your_secret_key', // Change this to a random, strong secret
    resave: false,
    saveUninitialized: true
}));
// Set EJS as the template engine
app.set('view engine', 'ejs');

// Set the directory for EJS files (default is 'views')
app.set('views', path.join(__dirname, 'views'));

// static file
const frontendDist = path.join(__dirname, '..', 'frontend', 'dist');
app.use(express.static(frontendDist, { index: false, etag: false, maxAge: 0 }));

function serveFrontend(req, res) {
    res.sendFile(path.join(frontendDist, 'index.html'), { maxAge: 0 });
}

// Use the cookie-parser middleware
app.use(cookieParser());


//- ---------------- connection ------------------------- - //

// Open the local database and expose the small query interface used by the routes.
const database = new sqlite3.Database(path.join(__dirname, '..', 'whisperloud.sqlite'));
const con = {
    query(sql, params, callback) {
        if (typeof params === 'function') {
            callback = params;
            params = [];
        }

        const statement = sql.trim().toUpperCase();
        const isRead = statement.startsWith('SELECT') || statement.startsWith('WITH');
        if (isRead) {
            return database.all(sql, params, callback);
        }

        return database.run(sql, params, function (err) {
            if (callback) {
                callback.call(this, err, {
                    insertId: this.lastID,
                    affectedRows: this.changes
                });
            }
        });
    },
    promise() {
        return {
            query(sql, params = []) {
                return new Promise((resolve, reject) => {
                    const statement = sql.trim().toUpperCase();
                    const isRead = statement.startsWith('SELECT') || statement.startsWith('WITH');
                    const callback = (err, rows) => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve([rows, undefined]);
                        }
                    };

                    if (isRead) {
                        database.all(sql, params, callback);
                    } else {
                        database.run(sql, params, function (err) {
                            if (err) {
                                reject(err);
                            } else {
                                resolve([{ insertId: this.lastID, affectedRows: this.changes }, undefined]);
                            }
                        });
                    }
                });
            }
        };
    }
};

database.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS users (
        user_id INTEGER PRIMARY KEY AUTOINCREMENT,
        username VARCHAR(50) NOT NULL,
        email VARCHAR(100) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        bio VARCHAR(200) DEFAULT 'not entered!',
        birthdate DATE DEFAULT NULL,
        address VARCHAR(100) DEFAULT 'not entered!',
        profilephoto VARCHAR(100) DEFAULT './assets/default.jpg',
        memberSince DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS thoughts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        content TEXT NOT NULL,
        upvotes INTEGER DEFAULT 0,
        downvotes INTEGER DEFAULT 0,
        image_url VARCHAR(255) DEFAULT NULL,
        username VARCHAR(200) DEFAULT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        comments INTEGER DEFAULT 0,
        FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        thought_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        comment_text TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (thought_id) REFERENCES thoughts (id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS votes (
        vote_id INTEGER PRIMARY KEY AUTOINCREMENT,
        thought_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        vote_type TEXT NOT NULL CHECK (vote_type IN ('upvote', 'downvote')),
        UNIQUE (thought_id, user_id),
        FOREIGN KEY (thought_id) REFERENCES thoughts (id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS follows (
        followerId INTEGER NOT NULL,
        followingId INTEGER NOT NULL,
        FOREIGN KEY (followerId) REFERENCES users (user_id) ON DELETE CASCADE,
        FOREIGN KEY (followingId) REFERENCES users (user_id) ON DELETE CASCADE,
        UNIQUE (followerId, followingId)
    );
`);

// Use a 16-byte key (128-bit)
const ENCRYPTION_KEY = 'echoes2541234567'; // 16-byte key (128-bit)
const IV_LENGTH = 16; // AES block size (128-bit)

function encrypt(userId) {
  // Convert userId (number) to string for encryption
  const userIdStr = String(userId);

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-128-cbc', Buffer.from(ENCRYPTION_KEY), iv);
  let encrypted = cipher.update(userIdStr, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted; // Return iv and encrypted text together
}

function decrypt(encryptedData) {
  const [ivHex, encryptedText] = encryptedData.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-128-cbc', Buffer.from(ENCRYPTION_KEY), iv);
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  // Convert the decrypted string back to a number
  return Number(decrypted);
}

function publicUploadUrl(filePath) {
        if (!filePath) return null;
        const normalized = String(filePath).replace(/\\/g, '/');
        const uploadIndex = normalized.indexOf('uploads/');
        return uploadIndex >= 0 ? `/${normalized.slice(uploadIndex)}` : normalized;
}


// ---------------------- ========== [ MULTER ] ========= ------------------------ 

const uploadsRoot = path.join(__dirname, '..', 'uploads');
const profileUploads = path.join(uploadsRoot, 'profilephotos');
const postUploads = path.join(uploadsRoot, 'postphotos');
fs.mkdirSync(profileUploads, { recursive: true });
fs.mkdirSync(postUploads, { recursive: true });

// Serve the uploads folder as static
app.use('/uploads', express.static(uploadsRoot));

// Define multer storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsRoot);
    },
    filename: (req, file, cb) => {
        cb(null, String(Date.now()));
    }
});

const upload = multer({ storage: storage });

/***************************** */
const profilePictureStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, profileUploads);
    },
    // ... (rest of the config)
    filename: (req, file, cb) => {
        cb(null, String(Date.now()));
    }
});

const uploadOptions = {
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, callback) => {
        if (!file.mimetype.startsWith('image/')) return callback(new Error('Only image files are allowed'));
        callback(null, true);
    }
};
const uploadProfilePicture = multer({ storage: profilePictureStorage, ...uploadOptions });

const postImageStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, postUploads);
    },
    // ... (rest of the config)
    filename: (req, file, cb) => {
        cb(null, String(Date.now()));
    }
});

const uploadPostImage = multer({ storage: postImageStorage, ...uploadOptions });

const handleUpload = middleware => (req, res, next) => {
    middleware(req, res, error => {
        if (error) return res.status(400).json({ error: error.message || 'Unable to upload file' });
        next();
    });
};

const requireUser = (req, res, next) => {
    if (!req.cookies.email || !req.cookies.username) return res.status(401).json({ error: 'Authentication required' });
    next();
};


 // -------------- [ coding of site ] ------------


// Serve the HTML form
app.get('/', (req, res) => {
    serveFrontend(req, res);
});


app.get('/login', (req, res) => {
    serveFrontend(req, res);
});

app.get(['/dashboard', '/createpost', '/profile', '/updateProfile'], (req, res) => {
    serveFrontend(req, res);
});

app.get('/user/:username', (req, res) => {
    serveFrontend(req, res);
});

const requireAdmin = (req, res, next) => {
    if (!req.session.isAdmin) {
        return res.status(401).json({ error: 'Admin authentication required' });
    }
    next();
};

app.get('/admin', (req, res) => {
    serveFrontend(req, res);
});

app.post('/admin/login', (req, res) => {
    const { username, password } = req.body;
    if (username !== 'admin' || password !== 'admin') {
        return res.status(401).json({ error: 'Invalid admin credentials' });
    }

    req.session.isAdmin = true;
    res.json({ success: true });
});

app.post('/admin/logout', (req, res) => {
    req.session.isAdmin = false;
    res.json({ success: true });
});

app.get('/api/auth/me', (req, res) => {
    const userId = currentUserId(req);
    if (!userId || !req.cookies.username) return res.status(401).json({ authenticated: false });
    res.json({ authenticated: true, username: req.cookies.username });
});

app.get('/admin/api/overview', requireAdmin, async (req, res) => {
    try {
        const [users] = await con.promise().query('SELECT user_id, username, email, memberSince FROM users ORDER BY memberSince DESC');
        const [thoughts] = await con.promise().query('SELECT id, username, content, upvotes, downvotes, created_at FROM thoughts ORDER BY created_at DESC');
        const [commentCount] = await con.promise().query('SELECT COUNT(*) AS count FROM comments');
        res.json({ users, thoughts, comments: commentCount[0].count });
    } catch (err) {
        console.error('Error loading admin overview:', err);
        res.status(500).json({ error: 'Unable to load admin overview' });
    }
});

app.delete('/admin/api/thoughts/:id', requireAdmin, (req, res) => {
    con.query('DELETE FROM thoughts WHERE id = ?', [req.params.id], (err) => {
        if (err) return res.status(500).json({ error: 'Unable to remove thought' });
        res.json({ success: true });
    });
});

// - ---------------- sign up ------------------------- - //
app.get('/logout', (req, res) => {
    res.clearCookie("email");
    res.clearCookie("username");
    req.session.destroy(() => res.redirect("/"));
});


// - ---------------- sign up ------------------------- - //

app.post('/signup', async (req, res) => {
    const { username, email, password } = req.body;
  
    // Input validation
    if (!username || !email || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }
  
    // Check if user already exists
    con.query('SELECT * FROM users WHERE email = ?', [email], async (err, results) => {
      if (err) {
        return res.status(500).json({ message: 'Database error' });
      }
  
      if (results.length > 0) {
        return res.status(400).json({ message: 'Email is already registered' });
      }
  
      // Hash the password
      const hashedPassword = await bcrypt.hash(password, 10);
  
      // Insert user into the database
      con.query('INSERT INTO users (username, email, password) VALUES (?, ?, ?)', [username, email, hashedPassword], (err, result) => {
        if (err) {
          return res.status(500).json({ message: 'Failed to register user' });
        }
  
        res.status(201).json({ message: 'User registered successfully' });
      });
    });
  });
  

// - ---------------- sign in ------------------------- - //

// Handle form submission for signin
app.post('/signin', (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    // Debugging: Log the received data
    // console.log('Received data:', { email });

    const selectSql = `SELECT * FROM users WHERE email=?`;

    // Execute the select query
    con.query(selectSql, [email], async function (err, results) {
        if (err) {
            console.error("Database query error:", err);
            return res.status(500).json({ error: 'Unable to sign in.' });
        }

        if (results.length === 0) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const user = results[0];

        // Compare the provided password with the hashed password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Debugging: Log user details
        // console.log('User signed in:', user);


        const user_id = user.user_id; // Example user_id

    // Encrypt user_id
    const encryptedUserId = encrypt(user_id);

        // Set cookies
        res.cookie('email', encryptedUserId, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
            sameSite: 'Strict',
        });

        res.cookie('username', user.username, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
            sameSite: 'Strict',
        });

        req.session.username = user.username;
        return res.redirect('/dashboard');
    });
});



// - ---------------- [ Creation of Post ] ------------------------- - //

app.get('/createpost', (req, res) => {

    const cookies = req.headers.cookie;

    if (!(cookies && cookies.includes("email") && cookies.includes("username"))) {
        res.redirect("/login");
    }
    return res.render(__dirname + '/views/createpost.ejs');
})

// Schedule a task to run every day at midnight
// cron.schedule('0 0 * * *', () => {
//     const resetQuery = 'UPDATE users ';
//     con.query(resetQuery, (err, result) => {
//       if (err) {
//         console.error('Error resetting todayPost:', err);
//       } else {
//         console.log('Successfully reset todayPost for all users at midnight.');
//       }
//     });
// });

app.post('/createPost', requireUser, handleUpload(uploadPostImage.single('postphoto')), (req, res) => {
    // Validate cookies
    const { email, username } = req.cookies;
    if (!email || !username) {
        return res.redirect("/login");
    }
  
    // Decrypt user id from cookie
    const encryptedUserId = email;
    if (!encryptedUserId) {
        return res.status(400).send('No user_id cookie found');
    }
    const user_id = decrypt(encryptedUserId);
    
    if (isNaN(user_id)) {
        return res.status(400).send('Invalid user ID');
    }

    const postDescription = req.body.postDescription;
    const postPicPath = req.file ? `/uploads/postphotos/${req.file.filename}` : null;
    
    // Insert the post if the limit hasn't been reached
    const insertSql = `INSERT INTO thoughts (username, user_id, content, image_url) VALUES (?, ?, ?, ?)`;
    
    con.query(insertSql, [username, user_id, postDescription, postPicPath], function (err, insertResult) {
        if (err) {
            console.error("Error inserting data: ", err);
            return res.status(500).send("Error in posting!");
        }

        // Success response
        return res.redirect('/dashboard');
    });
});

  

// -  ****************** [ dashboard page] ***************  - //
//updates last

app.get('/dashboard', async (req, res) => {
    try {
        const cookies = req.headers.cookie;
        if (!(cookies && cookies.includes("email") && cookies.includes("username"))) {
            return res.redirect("/login");
        }

        const encryptedUserId = req.cookies.email;
        const username = req.cookies.username;
        if (!encryptedUserId) {
            return res.status(400).send('No user_id cookie found');
        }

        const userId = decrypt(encryptedUserId);
        
        // Pagination parameters

        const selectQuery = `
        SELECT 
            t.id AS thought_id, 
            t.username, 
            t.content, 
            t.image_url, 
            t.upvotes, 
            t.downvotes, 
            t.created_at,
            c.comment_text, 
            c.user_id AS comment_user_id, 
            u1.profilephoto AS ProfilePhoto,
            u2.profilephoto AS CommentProfilePhoto,
            u2.username AS comment_username,
            c.thought_id AS c_tid
        FROM (
            SELECT * 
            FROM thoughts 
            ORDER BY created_at DESC 
            LIMIT 7
        ) t
        LEFT JOIN comments c ON t.id = c.thought_id
        LEFT JOIN users u1 ON t.username = u1.username
        LEFT JOIN users u2 ON c.user_id = u2.user_id
        ORDER BY t.created_at DESC, c.created_at DESC;
    `;
    

        const [results] = await con.promise().query(selectQuery);

        // Group posts and comments
        const posts = results.reduce((acc, row) => {
            const post = acc.find(p => p.thought_id === row.thought_id);
            if (post) {
                if (row.comment_text) {
                    post.comments.push({
                        username: row.comment_username,
                        text: row.comment_text,
                        comment_t_id: row.c_tid
                    });
                }
            } else {
                acc.push({
                    profilePhoto: row.ProfilePhoto,
                    thought_id: row.thought_id,
                    user:username,
                    p_username: row.username,
                    content: row.content,
                    image_url: publicUploadUrl(row.image_url),
                    upvotes: row.upvotes,
                    downvotes: row.downvotes,
                    created_at: row.created_at,
                    comments: row.comment_text
                        ? [{ username: row.comment_username, text: row.comment_text, comment_t_id: row.c_tid }]
                        : []
                });
            }
            return acc;
        }, []);
        console.log(posts);

        res.render('dashboard', { data: posts });

    } catch (err) {
        console.error('Error fetching posts with comments:', err);
        res.status(500).send('Error fetching posts with comments');
    }
});


app.get('/loadMorePosts', async (req, res) => {
    try {
        const cookies = req.headers.cookie;
        if (!(cookies && cookies.includes("email") && cookies.includes("username"))) {
            return res.redirect("/login");
        }

        const encryptedUserId = req.cookies.email;
        if (!encryptedUserId) {
            return res.status(400).send('No user_id cookie found');
        }

        const userId = decrypt(encryptedUserId);
        
        // Pagination parameters
        const offset = parseInt(req.query.offset) || 0;
        const limit = 7; // Define the limit here

        // 1. Get the post IDs for the current page:
        const postIdsQuery = `
            SELECT id
            FROM thoughts
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?;
        `;

        const [postIdsResult] = await con.promise().query(postIdsQuery, [limit, offset]);

        if (postIdsResult.length === 0) {
            return res.json({ success: true, posts: [] }); // No more posts
        }

        const postIds = postIdsResult.map(row => row.id);

        // 2. Fetch posts and comments based on the retrieved IDs:
        const selectQuery = `
            SELECT 
                t.id AS thought_id, 
                t.username, 
                t.content, 
                t.image_url, 
                t.upvotes, 
                t.downvotes, 
                t.created_at,
                c.comment_text, 
                c.user_id AS comment_user_id, 
                u1.profilephoto AS ProfilePhoto,
                u2.profilephoto AS CommentProfilePhoto,
                u2.username AS comment_username,
                c.thought_id AS c_tid
            FROM thoughts t
            LEFT JOIN comments c ON t.id = c.thought_id
            LEFT JOIN users u1 ON t.username = u1.username
            LEFT JOIN users u2 ON c.user_id = u2.user_id
            WHERE t.id IN (?)  
            ORDER BY t.created_at DESC, c.created_at ASC;
        `;
        const placeholders = postIds.map(() => '?').join(', ');
        const [results] = await con.promise().query(
            selectQuery.replace('IN (?)', `IN (${placeholders})`),
            postIds
        );
        // const [results] = await con.promise().query(selectQuery, [offset]);

        // Group posts and comments
        const posts = results.reduce((acc, row) => {
            const post = acc.find(p => p.thought_id === row.thought_id);
            if (post) {
                if (row.comment_text) {
                    post.comments.push({
                        username: row.comment_username,
                        text: row.comment_text,
                        comment_t_id: row.c_tid
                    });
                }
            } else {
                acc.push({
                    profilePhoto: row.ProfilePhoto,
                    thought_id: row.thought_id,
                    username: row.username,
                    content: row.content,
                    image_url: publicUploadUrl(row.image_url),
                    upvotes: row.upvotes,
                    downvotes: row.downvotes,
                    created_at: row.created_at,
                    comments: row.comment_text
                        ? [{ username: row.comment_username, text: row.comment_text, comment_t_id: row.c_tid }]
                        : []
                });
            }
            return acc;
        }, []);
        console.log(posts);

        res.json({ success: true, posts }); // ✅ Send JSON response

    } catch (err) {
        console.error('Error fetching posts with comments:', err);
        res.status(500).send('Error fetching posts with comments');
    }
});



// ----------------  ****************** [ Profile page] ***************  ---------------- //

function currentUserId(req) {
    if (!req.cookies.email) return null;
    const userId = decrypt(req.cookies.email);
    return Number.isNaN(userId) ? null : userId;
}

app.get('/api/profile', (req, res) => {
    const userId = currentUserId(req);
    if (!userId) return res.status(401).json({ error: 'Authentication required' });
    con.query('SELECT user_id, username, email, bio, birthdate, address, profilephoto, memberSince FROM users WHERE user_id = ?', [userId], (err, results) => {
        if (err) return res.status(500).json({ error: 'Unable to load profile' });
        if (!results.length) return res.status(404).json({ error: 'User not found' });
        res.json(results[0]);
    });
});

app.put('/api/profile', requireUser, handleUpload(uploadProfilePicture.single('profilephoto')), (req, res) => {
    const userId = currentUserId(req);
    if (!userId) return res.status(401).json({ error: 'Authentication required' });
    const { bio, address, birth, oldpassword, newpassword } = req.body;
    if (newpassword && !oldpassword) return res.status(400).json({ error: 'Current password is required to set a new password' });
    con.query('SELECT password FROM users WHERE user_id = ?', [userId], (selectError, results) => {
        if (selectError) return res.status(500).json({ error: 'Unable to load profile' });
        const saveProfile = (password) => {
                const profilePhoto = req.file ? `/uploads/profilephotos/${req.file.filename}` : null;
                const updateQuery = 'UPDATE users SET password = COALESCE(?, password), bio = COALESCE(?, bio), address = COALESCE(?, address), profilephoto = COALESCE(?, profilephoto), birthdate = COALESCE(?, birthdate) WHERE user_id = ?';
                con.query(updateQuery, [password, bio === undefined ? null : bio, address === undefined ? null : address, profilePhoto, birth || null, userId], (updateError) => {
                    if (updateError) return res.status(500).json({ error: 'Unable to update profile' });
                    con.query('SELECT user_id, username, email, bio, birthdate, address, profilephoto, memberSince FROM users WHERE user_id = ?', [userId], (loadError, updated) => {
                        if (loadError) return res.status(500).json({ error: 'Profile updated but could not be loaded' });
                        res.json({ success: true, user: updated[0] });
                    });
                });
        };
        if (!newpassword) return saveProfile(null);
        bcrypt.compare(oldpassword, results[0].password, (compareError, valid) => {
            if (compareError) return res.status(500).json({ error: 'Unable to verify password' });
            if (!valid) return res.status(401).json({ error: 'Invalid current password' });
            bcrypt.hash(newpassword, 10, (hashError, hashedPassword) => {
                if (hashError) return res.status(500).json({ error: 'Unable to update password' });
                saveProfile(hashedPassword);
            });
        });
    });
});

app.get('/api/users/:username', async (req, res) => {
    const viewerId = currentUserId(req);
    try {
        const [users] = await con.promise().query(
            'SELECT user_id, username, bio, profilephoto, memberSince FROM users WHERE username = ?',
            [req.params.username]
        );
        if (!users.length) return res.status(404).json({ error: 'User not found' });
        const user = users[0];
        const [followers] = await con.promise().query(
            'SELECT u.user_id, u.username, u.profilephoto FROM follows f JOIN users u ON u.user_id = f.followerId WHERE f.followingId = ? ORDER BY u.username',
            [user.user_id]
        );
        const [following] = await con.promise().query(
            'SELECT u.user_id, u.username, u.profilephoto FROM follows f JOIN users u ON u.user_id = f.followingId WHERE f.followerId = ? ORDER BY u.username',
            [user.user_id]
        );
        const isFollowing = viewerId ? followingForUser(viewerId, user.user_id) : Promise.resolve(false);
        res.json({
            ...user,
            profilephoto: publicUploadUrl(user.profilephoto),
            followers,
            following,
            isFollowing: await isFollowing,
            isSelf: viewerId === user.user_id,
        });
    } catch (error) {
        console.error('Error loading public profile:', error);
        res.status(500).json({ error: 'Unable to load user profile' });
    }
});

function followingForUser(followerId, followingId) {
    return con.promise().query(
        'SELECT 1 FROM follows WHERE followerId = ? AND followingId = ?',
        [followerId, followingId]
    ).then(([rows]) => rows.length > 0);
}

app.post('/api/users/:username/follow', requireUser, async (req, res) => {
    const followerId = currentUserId(req);
    try {
        const [users] = await con.promise().query('SELECT user_id FROM users WHERE username = ?', [req.params.username]);
        if (!users.length) return res.status(404).json({ error: 'User not found' });
        const followingId = users[0].user_id;
        if (followerId === followingId) return res.status(400).json({ error: 'You cannot follow yourself' });
        await con.promise().query('INSERT OR IGNORE INTO follows (followerId, followingId) VALUES (?, ?)', [followerId, followingId]);
        res.json({ success: true, isFollowing: true });
    } catch (error) {
        console.error('Error following user:', error);
        res.status(500).json({ error: 'Unable to follow user' });
    }
});

app.delete('/api/users/:username/follow', requireUser, async (req, res) => {
    const followerId = currentUserId(req);
    try {
        const [users] = await con.promise().query('SELECT user_id FROM users WHERE username = ?', [req.params.username]);
        if (!users.length) return res.status(404).json({ error: 'User not found' });
        await con.promise().query('DELETE FROM follows WHERE followerId = ? AND followingId = ?', [followerId, users[0].user_id]);
        res.json({ success: true, isFollowing: false });
    } catch (error) {
        console.error('Error unfollowing user:', error);
        res.status(500).json({ error: 'Unable to unfollow user' });
    }
});

app.get('/profile', (req, res) => {
    const cookies = req.headers.cookie;

    if (!(cookies && cookies.includes("email") && cookies.includes("username"))) {
        return res.redirect("/login");
    }
    
    // Decrypt the email to get user_id
    const encryptedUserId = req.cookies.email;

    if (!encryptedUserId) {
        return res.status(400).send('No user_id cookie found');
    }

    // Assuming 'decrypt' function returns a numeric value
    const id = decrypt(encryptedUserId);
    // console.log("Decrypted user_id:", id);

    // Ensure id is a valid number
    const userId = parseInt(id, 10); // Use the base 10 for parsing
    if (isNaN(userId)) {
        return res.status(400).send('Invalid user ID');
    }

    const selectQuery = "SELECT * from users WHERE user_id = ?";

    con.query(selectQuery, [userId], (err, results) => {
        // console.log(results);
        if (err) {
            console.error('Error fetching data:', err);
            return res.status(500).send('Error fetching data');
        }

        // Render the EJS file and pass the results
        res.render('profile', { data: results });
    });
});


// ----------------  ****************** [ Another Account] ***************  ----------------- //

const processedRequests = new Set(); // Store processed usernames

app.get('/search/:username', (req, res) => {
    const { username } = req.params;
    
    // ✅ Ignore duplicate or invalid requests
    if (!username || username.includes("uploads") || processedRequests.has(username)) {
        console.warn("❌ Ignoring duplicate or invalid request:", username);
        return res.status(204).send(); // 204 No Content (Silent ignore)
    }

    // ✅ Mark this request as processed
    processedRequests.add(username);

    // console.log("🔍 Searching for:", username);

    const selectQuery = `SELECT username, email, birthdate, address, profilephoto, memberSince, bio FROM users WHERE username = ?`;

    con.query(selectQuery, [username], (err, results) => {
        if (err) {
            console.error('❌ Error fetching data:', err);
            return res.status(500).send('Error fetching data');
        }

        // console.log("📌 Database results:", results);
        res.render('anotherAccount', { data: results });

        // ✅ After a short time, allow processing of this username again
        setTimeout(() => processedRequests.delete(username), 5000); // 5-second reset
    });
});






// ---------------- ****************** [ upadate Profile ] ********************* ----------------------- //
app.get('/updateProfile', (req, res) => {
    if (!(req.cookies.email && req.cookies.username)) {
        return res.redirect("/login");
    }
    res.render(__dirname + '/views/updateProfile.ejs');
});


// ---------------- ****************** [ Change Profile ] ********************* ----------------------- //


// Handle form submission with file upload
app.post('/changeProfile', uploadProfilePicture.single('profilephoto'), (req, res) => {
    if (!(req.cookies.email && req.cookies.username)) {
        return res.redirect("/login");
    }

    const encryptedUserId = req.cookies.email;
    if (!encryptedUserId) {
        return res.status(400).send('No user_id cookie found');
    }

    const id = decrypt(encryptedUserId);
    if (!id) {
        return res.redirect("/login");
    }

    let bio = req.body.bio;
    let birth = req.body.birth ? new Date(req.body.birth).toISOString().split('T')[0] : null;
    let address = req.body.address;
    let oldpwd = req.body.oldpassword;
    let newpwd = req.body.newpassword;

    let profilePicPath = req.file ? `/uploads/profilephotos/${req.file.filename}` : null;

    // console.log("Received Birthdate:", req.body.birth, "Formatted:", birth);

    const selectQuery = "SELECT * FROM users WHERE user_id = ?";
    const updateQuery = "UPDATE users SET password = ?, bio = ?, address = ?, profilephoto = COALESCE(?, profilephoto), birthdate = COALESCE(?, birthdate) WHERE user_id = ?";
 
    con.query(selectQuery, [id], (err, results) => {
        if (err) {
            console.error('Error fetching data:', err);
            return res.status(500).send('Error fetching data');
        }

        if (results.length === 0) {
            return res.status(404).send('User not found');
        }

        let inputedpwd = results[0].password;

        bcrypt.compare(oldpwd, inputedpwd, (err, isMatch) => {
            if (err) {
                console.error('Error comparing passwords:', err);
                return res.status(500).send('Error comparing passwords');
            }

            if (!isMatch) {
                return res.status(401).json({ error: 'Invalid password' });
            }

            bcrypt.hash(newpwd, 10, (err, hashedPassword) => {
                if (err) {
                    console.error('Error hashing the new password:', err);
                    return res.status(500).send('Error hashing the new password');
                }

                // console.log("Updating with values:", { hashedPassword, bio, address, profilePicPath, birth, id });

                con.query(updateQuery, [hashedPassword, bio, address, profilePicPath, birth, id], (err) => {
                    if (err) {
                        console.error('Error updating data:', err);
                        return res.status(500).send('Error updating data');
                    }
                    return res.redirect('/profile');
                });
            });
        });
    });
});



/***********************************************  [ upvote/downvote ]  *************************************************/
app.post("/vote", (req, res) => {
    const encryptedUserId = req.cookies.email;
    if (!encryptedUserId) {
        return res.status(400).send('No user_id cookie found');
    }
    const user_id = decrypt(encryptedUserId);
    
    if (isNaN(user_id)) {
        return res.status(400).send('Invalid user ID');
    }
    const { thought_id, vote_type } = req.body;
    if (!['upvote', 'downvote'].includes(vote_type)) {
        return res.status(400).json({ error: 'Invalid vote type' });
    }
    // console.log(thought_id);

    // Check if user has already voted
    let checkVote = "SELECT * FROM votes WHERE thought_id = ? AND user_id = ?";
    con.query(checkVote, [thought_id, user_id], (err, results) => {
        if (err) throw err;

        if (results.length > 0) {
            res.json({ success: false, message: "You have already voted!" });
        } else {
            // Insert vote record
            let insertVote = "INSERT INTO votes (thought_id, user_id, vote_type) VALUES (?, ?, ?)";
            con.query(insertVote, [thought_id, user_id, vote_type], (err) => {
                if (err) throw err;

                // Update vote count
                let updateVote = `UPDATE thoughts SET ${vote_type}s = ${vote_type}s + 1 WHERE id = ?`;
                con.query(updateVote, [thought_id], (err) => {
                    if (err) throw err;

                    // Fetch new vote count
                    let getNewCount = `SELECT ${vote_type}s FROM thoughts WHERE id = ?`;
                    con.query(getNewCount, [thought_id], (err, result) => {
                        if (err) throw err;
                        res.json({ success: true, new_count: result[0][`${vote_type}s`] });
                    });
                });
            });
        }
    });
});
    

/***********************************************  [ Comment ]  *************************************************/

// Post a Comment
app.post('/comment', requireUser, (req, res) => {
    const { thought_id, comment_text } = req.body;
    if (!Number.isInteger(Number(thought_id)) || !comment_text || !comment_text.trim()) {
        return res.status(400).json({ error: 'A thought ID and comment are required' });
    }
    const cookies = req.headers.cookie;

    if (!(cookies && cookies.includes("email") && cookies.includes("username"))) {
        return res.redirect("/login");
    }
    
    // Decrypt the email to get user_id
    const encryptedUserId = req.cookies.email;

    if (!encryptedUserId) {
        return res.status(400).send('No user_id cookie found');
    }

    // Assuming 'decrypt' function returns a numeric value
    const user_id = decrypt(encryptedUserId); // Assuming session exists

    if (!user_id) return res.status(401).json({ error: "User not authenticated" });

    const sql = "INSERT INTO comments (thought_id, user_id, comment_text) VALUES (?, ?, ?)";

    con.query(sql, [thought_id, user_id, comment_text], (err, result) => {
        if (err) {
            console.error("Error posting comment:", err);
            return res.status(500).json({ error: "Internal Server Error" });
        }

        con.query('UPDATE thoughts SET comments = comments + 1 WHERE id = ?', [thought_id], (countError) => {
            if (countError) return res.status(500).json({ error: 'Comment saved but count could not be updated' });
            res.json({ success: true, username: req.session.username });
        });
    });
});


app.listen(PORT, () => {
    console.log(`Server is running on port : http://localhost:${PORT}/`);
}); 