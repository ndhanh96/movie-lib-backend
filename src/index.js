const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const argon2 = require('argon2');
var passport = require('passport');
var Strategy = require('passport-local');

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

passport.use(
  new Strategy(async (username, password, cb) => {
    try {
      const getData = await prisma.users.findUnique({
        where: {
          username: username,
        },
      });

      if (!getData) {
        console.log('that bai');
        return cb(null, false);
      }
      if (!(await argon2.verify(getData.password, password))) {
        console.log('that bai');
        return cb(null, false);
      }

      let user = {
        id: getData.id.toString(),
        username: getData.username,
        password: getData.password,
      };
      console.log('dang nhap thanh cong');
      return cb(null, user);
    } catch (error) {
      console.log('ERRORRRRR');
      return cb(error);
    }
  })
);

passport.serializeUser(function (user, cb) {
  process.nextTick(function () {
    cb(null, { id: user.id, username: user.username });
  });
});
passport.deserializeUser(function (user, cb) {
  process.nextTick(function () {
    return cb(null, user);
  });
});


const app = express();
app.use(cors({ origin: 'http://localhost:3000', credentials: true }));
app.use(express.json()); // for parsing application/json
app.use(express.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded
app.use(cookieParser());
app.use(
  require('express-session')({
    secret: 'keyboard cat',
    resave: false,
    saveUninitialized: false,
    proxy: true,
  })
);

app.use(passport.initialize());
app.use(passport.authenticate('session'));

app.get('/', (req, res) => {
  res.send(`Hello ${req.user ? req.user.username : 'World'}`);
});

app.get('/feed', async (req, res) => {
  try {
    const feedData = await prisma.users.findMany();
    res.send(feedData[0] || 'not found');
  } catch (error) {
    res.send(error);
  }
});

app.post(
  '/login',
  passport.authenticate('local', {
    successRedirect: '/login',
    failureRedirect: '/loginfail',
  })
);

app.post('/signup', async (req, res) => {
  if (req.user) {
    return res.send('Exit First');
  }
  if (
    String(req.body.username).length >= 4 &&
    String(req.body.password).length >= 4
  ) {
    try {
      const newUser = await prisma.users.create({
        data: {
          username: String(req.body.username),
          password: await argon2.hash(req.body.password),
        },
      });
      res.send({ success: true });
    } catch (error) {
      console.error(error);
      res.send({ success: false });
    }
  } else {
    res.send({ success: false });
  }
});

const checkShowInDB = async (req, res, next) => {
  let showid = req.query.showid || req.body.showid;
  if (!req.user) {
    return res.send({ isItLiked: false, showaddstatus:false });
  }

  try {
    const showDB = await prisma.items.findFirst({
      where: {
        AND: [
          { movieid: Number(showid) },
          { userID: Number(req.user.id) },
        ],
      },
    });
    if (
      showDB &&
      showDB.movieid == Number(showid) &&
      showDB.userID == Number(req.user.id)
    ) {
      return res.send({ isItLiked: true, showaddstatus:false });
    }
    next();
  } catch (error) {
    console.log(error);
    res.send({ isItLiked: false });
  }
};

app.get('/checkshow', checkShowInDB, (req, res) => {
  console.log(req.query.showid);
  res.send({ isItLiked: false });
});

app.post('/addshow', checkShowInDB, async (req, res) => {
  try {
    const addShow = await prisma.items.create({
      data: {
        movieid: Number(req.body.showid),
        userID: Number(req.user.id),
        format: req.body.format,
      },
    });
    console.log(addShow);
    res.send({ ...addShow, showaddstatus: true });
  } catch (error) {
    console.log(error);
    res.send({ showaddstatus: false });
  }
});

app.get('/login', function (req, res, next) {
  if (req.user) {
    console.log('log in');
    res.json({ ...req.user, isLogin: true });
  } else {
    res.redirect('/loginfail');
  }
});

app.get('/logout', (req, res) => {
  console.log('logout');
  req.logOut();
  res.json({ isLogin: false });
});

app.get('/loginfail', (req, res) => {
  res.json({ isLogin: false });
});

const port = process.env.PORT || 3001

app.listen(port, () => {
  console.log(`Example app listening at port ${port}`);
});
