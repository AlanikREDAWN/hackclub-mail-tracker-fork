import "dotenv/config";
import express from 'express';
import KeyvSqlite from '@keyv/sqlite';
import Keyv from 'keyv';
import { randomUUID } from "crypto";
async function getAll() {
    const items = []
    for await (const [key, value] of db.iterator()) {
        // console.log(key, value);
        items.push({ key, value })
      };
      return items;
}
// sqlite setup
function sendToSlack(messageObj) {
    return fetch("https://slack.com/api/chat.postMessage", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${process.env.SLACK_TOKEN}`
        },
        body: JSON.stringify(messageObj)
    }).then(res => res.json());
}
const app = express();
app.set('view engine', 'ejs');
app.set("views", import.meta.dirname + "/views");
app.use(express.urlencoded({ extended: true }));
const keyvSqlite = new KeyvSqlite('sqlite://database.db');
// keyvSqlite.en 
const db = new Keyv({ store: keyvSqlite  });
function authed(req,res,next) {
    if (req.headers.authorization !== process.env.AUTH_TOKEN && req.query.token !== process.env.AUTH_TOKEN && !req.headers["Cookie"].includes(process.env.AUTH_TOKEN)) {
        res.status(401).send("Unauthorized");
        return;
    }
    next();
}
app.get('/', (req,res) => {
    // res.send("meow:3")
    res.sendFile(import.meta.dirname + "/assets/nora-mail.gif")
})
app.get('/middleman/:id', (req,res) => {
// meow meow
})

app.get('/i-got-mail/:id', (req,res) => {

})
app.get('/heartbeat-from-nice-postal-worker', (req,res) => {
    
})

app.post('/create', authed, (req,res) => {
const id = randomUUID()
db.set(id,{
    slack_id: req.body.slack_id,
    name_for_mail: req.body.name_for_mail,
    status: "not_sent"
})
sendToSlack({
    channel: process.env.SLACK_CHANNEL,
    text: `Neon has created a new mail for you. Please send it to <@${req.body.slack_id}> soon :3`
})
// res.json({ id })
res.redirect(`/dashboard?id=${id}`)
})

// getAll().then(console.log)
// rs here
app.get('/dashboard', authed, async (req,res) => {
    res.render('dashboard', { data: (await getAll() || [])  })
})
// db.get("meow")
app.listen(process.env.PORT || 3000, () => {
    console.log('listening on port 3000')
})