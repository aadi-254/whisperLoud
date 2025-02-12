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
const mysql = require('mysql2');
const path = require('path');
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
app.use(express.static(path.join(__dirname, 'public')));

// Use the cookie-parser middleware
app.use(cookieParser());


//- ---------------- connection ------------------------- - //

// Create a connection to the database
const con = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});


// Connect to the database once when the server starts
con.connect(function (err) {
    if (err) throw err;
    // console.log("Connected to the database");
});

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


// ---------------------- ========== [ MULTER ] ========= ------------------------ 

// Serve the uploads folder as static
app.use('/uploads', express.static('uploads'));

// Define multer storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, './uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, String(Date.now()));
    }
});

const upload = multer({ storage: storage });

/***************************** */
const profilePictureStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, './uploads/profilephotos'); // No 'public' here
    },
    // ... (rest of the config)
    filename: (req, file, cb) => {
        cb(null, String(Date.now()));
    }
});

const uploadProfilePicture = multer({ storage: profilePictureStorage });

const postImageStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, './uploads/postphotos'); // No 'public' here
    },
    // ... (rest of the config)
    filename: (req, file, cb) => {
        cb(null, String(Date.now()));
    }
});

const uploadPostImage = multer({ storage: postImageStorage });


 // -------------- [ coding of site ] ------------


// Serve the HTML form
app.get('/', (req, res) => {
    res.render(__dirname + '/views/index.ejs');
    // res.sendFile(__dirname + '/public/index.htm'); // Adjust the path as necessary
});


app.get('/login', (req, res) => {
    res.render(__dirname + '/views/login.ejs');
});

// - ---------------- sign up ------------------------- - //
app.get('/logout', (req, res) => {
    res.clearCookie("email");
    res.clearCookie("username");
    res.redirect("/");
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
            secure: true,
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
            sameSite: 'Strict',
        });

        res.cookie('username', user.username, {
            httpOnly: true,
            secure: true,
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
            sameSite: 'Strict',
        });

        return res.redirect('/dashboard'); // Redirect to dashboard.ejs
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

app.post('/createPost', uploadPostImage.single('postphoto'), (req, res) => {
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
    const postPicPath = req.file ? req.file.path : null;
    
    // Insert the post if the limit hasn't been reached
    const insertSql = `INSERT INTO thoughts (username, user_id, content, image_url) VALUES (?, ?, ?, ?)`;
    
    con.query(insertSql, [username, user_id, postDescription, postPicPath], function (err, insertResult) {
        if (err) {
            console.error("Error inserting data: ", err);
            return res.status(500).send("Error in posting!");
        }

        // Success response
        return res.status(200).send('Post created successfully');
    });
});

  

// -  ****************** [ dashboard page] ***************  - //


app.get('/dashboard', async (req, res) => {
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
            ORDER BY t.created_at DESC, c.created_at ASC
            LIMIT 7;
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
                    username: row.username,
                    content: row.content,
                    image_url: row.image_url,
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
        const [results] = await con.promise().query(selectQuery, [postIds]);
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
                    image_url: row.image_url,
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

        res.json({ success: true, posts }); // ✅ Send JSON response

    } catch (err) {
        console.error('Error fetching posts with comments:', err);
        res.status(500).send('Error fetching posts with comments');
    }
});



// ----------------  ****************** [ Profile page] ***************  ---------------- //

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

    let profilePicPath = req.file ? req.file.path : null;

    // console.log("Received Birthdate:", req.body.birth, "Formatted:", birth);

    const selectQuery = "SELECT * FROM users WHERE user_id = ?";
    const updateQuery = "UPDATE users SET password = ?, bio = ?, address = ?, profilephoto = ?, birthdate = COALESCE(?, birthdate) WHERE user_id = ?";
 
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
                    return res.status(200).send('Update successful!');
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
app.post('/comment', (req, res) => {
    const { thought_id, comment_text } = req.body;
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

        res.json({ success: true, username: req.session.username });
    });
});


app.listen(PORT, () => {
    console.log(`Server is running on port : http://localhost:${PORT}/`);
}); 