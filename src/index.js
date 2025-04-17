import "dotenv/config";
import express from "express";
import KeyvSqlite from "@keyv/sqlite";
import Keyv from "keyv";
import QRCode from "qrcode";
import { randomUUID } from "crypto";
import { dirname } from "path";
async function getAll() {
  const items = [];
  for await (const [key, value] of db.iterator()) {
    // console.log(key, value);
    items.push({ key, value });
  }
  return items;
}
// TODO: add delete and mark as sent thingy..
// sqlite setup
function sendToSlack(messageObj) {
  return fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.SLACK_TOKEN}`,
    },
    body: JSON.stringify(messageObj),
  }).then((res) => res.json());
}
const app = express();
app.set("view engine", "ejs");
app.set("views", process.cwd() + "/views");
app.use(express.urlencoded({ extended: true }));
const keyvSqlite = new KeyvSqlite("sqlite://database.db");
// keyvSqlite.en
const db = new Keyv({ store: keyvSqlite });
function authed(req, res, next) {
  if (
    req.headers.authorization !== process.env.AUTH_TOKEN &&
    req.query.token !== process.env.AUTH_TOKEN &&
    !(req.headers["Cookie"] || "").includes(process.env.AUTH_TOKEN)
  ) {
    res.status(401).send("Unauthorized");
    return;
  }
  next();
}
app.get("/", (req, res) => {
  // res.send("meow:3")
  res.sendFile(
    process.cwd() +
      `/assets/${Math.random() > 0.5 ? "nora-mail" : "zeon_shake"}.gif`,
  );
});
app.get("/middleman/:id", async (req, res) => {
  // meow meow
  const id = req.params.id;
  res.render("confirm", { id });
});
app.post("/middleman/confirm", async (req, res) => {
  const id = req.body.id;
  const item = await db.get(id);
  item.status = "past_middleman";
  item.heartbeats = item.heartbeats || [];
  item.heartbeats.push({
    type: "arrived",
    created_at: Date.now(),
    status: "arrived_at_hq",
  });
  sendToSlack({
    channel: process.env.SLACK_CHANNEL,
    text: `Package ${item.name_for_mail} (${id}) has arrived at HQ/middleman`,
  });
  sendToSlack({
    channel: item.slack_id,
    text: `Hey nora got your package ${item.name_for_mail} and is planning on sending it to you soon :3 which means it on the way or something`,
  });
  await db.set(id, item);
  res.send(`Thanks! your notification has been sent`);
});

app.get("/i-got-mail/:id", (req, res) => {
  // meow meow
  const id = req.params.id;
  res.render("confirm", { id });
});
app.get("/remove", authed, async (req, res) => {
  const id = req.query.id;
  res.render("confirm", { id });
});
app.post("/remove/confirm", authed, async (req, res) => {
  const id = req.body.id;
  await db.delete(id);
  res.redirect(`/dashboard`);
});
app.post("/i-got-mail/confirm", async (req, res) => {
  const id = req.body.id;
  const item = await db.get(id);
  item.status = "arrived";
  item.heartbeats = item.heartbeats || [];
  item.heartbeats.push({
    type: "arrived",
    created_at: Date.now(),
    status: "arrived",
  });
  sendToSlack({
    channel: process.env.SLACK_CHANNEL,
    text: `Package ${item.name_for_mail} (${id}) has arrived at recipient`,
  });
  sendToSlack({
    channel: item.slack_id,
    text: `Hey thanks for getting your package ${item.name_for_mail}`,
  });
  await db.set(id, item);
  res.send(`Thanks! your notification has been sent`);
});
app.get("/heartbeat-from-nice-postal-worker", async (req, res) => {
  // get id from queries
  const id = req.query.id;
  // update asap cuz its js a heartbeat
  const item = await db.get(id);
  item.heartbeats = item.heartbeats || [];
  item.heartbeats.push({
    type: "heartbeat",
    created_at: Date.now(),
  });
  sendToSlack({
    channel: process.env.SLACK_CHANNEL,
    text: `Package ${item.name_for_mail} (${id}) has recived some type of heartbeat lol maybe a very epic and cool postal worker. `,
  });
  await db.set(id, item);
  res.send(`Thanks postal worker! your heartbeat has been sent`);
});
app.get("/sent", authed, async (req, res) => {
  const id = req.query.id;
  const item = await db.get(id);
  item.status = "sent";

  sendToSlack({
    channel: process.env.SLACK_CHANNEL,
    text: `Package ${item.name_for_mail} (${id}) has been marked as sent to recipient`,
  });
  await db.set(id, item);
  res.redirect(`/dashboard?id=${id}`);
});
app.post("/create", authed, (req, res) => {
  const id = randomUUID();
  db.set(id, {
    slack_id: req.body.slack_id,
    name_for_mail: req.body.name_for_mail,
    status: "not_sent",
    heartbeats: [],
  });
  sendToSlack({
    channel: process.env.SLACK_CHANNEL,
    text: `Neon has created a new mail for you. Please send it to <@${req.body.slack_id}> soon :3`,
  });
  sendToSlack({
    channel: req.body.slack_id,
    text: `Hey neon is planning on sending mail or whatever "${req.body.name_for_mail}" is so i recommend contacting them if u dont want allat..`,
  });
  // res.json({ id })
  res.redirect(`/dashboard?id=${id}`);
});

// getAll().then(console.log)
// rs here
const imageTemplatesQR = [
  {
    image: `https://cachet.dunkirk.sh/emojis/nora/r`,
  },
  {
    image: `https://cachet.dunkirk.sh/emojis/tw_package/r`,
  },
  {
    image: undefined,
  },
];
app.get("/dashboard", authed, async (req, res) => {
  // generate qr codes moment
  const qrCodes = [];
  const qrCodes0 = await Promise.all(
    await getAll().then(async (items) => {
      return await Promise.all(
        items.map((item) => {
          let cImages = Array.from(imageTemplatesQR);
          cImages[0].text = `https://hackclub-mail-tracker.saahild.com/middleman/${item.key}`;
          cImages[1].text = `https://hackclub-mail-tracker.saahild.com/heartbeat-from-nice-postal-worker?id=${item.key}`;
          cImages[2].text = `https://hackclub-mail-tracker.saahild.com/i-got-mail/${item.key}`;
          return cImages.map((c) =>
            QRCode.toDataURL(c.text, {
              errorCorrectionLevel: "H",
              margin: 0,
              scale: 10,
              width: 70,
              height: 70,
            }),
          );
        }),
      );
    }),
  );
  for (let i = 0; i < qrCodes0.length; i++) {
    qrCodes[i] = [];
    for (let j = 0; j < qrCodes0[i].length; j++) {
      qrCodes[i].push(await qrCodes0[i][j]);
    }
  }
  console.log(qrCodes);
  res.render("dashboard", { data: (await getAll()) || [], qrCodes });
});
// db.get("meow")
app.listen(process.env.PORT || 3000, () => {
  console.log("listening on port 3000");
});
