const cors = require("cors");
const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("./utilisateur");
const Product = require("./produits");
const Commande = require("./commande");
const axios = require("axios");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const nodemailer = require("nodemailer");
const { text } = require("stream/consumers");
require("dotenv").config();

mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("Connecté à MongoDB Atlas"))
  .catch((err) => console.log("Erreur de connexion à MongoDB:", err));

const app = express();
app.use(
  cors({
    origin: ["https://tyshop.netlify.app", "http://localhost:3000"],
    methods: ["GET", "POST", "PUT", "DELETE"],
  })
);
app.use("/upload", express.static(path.join(__dirname, "uploads")));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, "uploads"); // Répertoire temporaire sur le backend
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true }); // Créer le répertoire s'il n'existe pas
    }
    cb(null, uploadDir); // Destination des fichiers sur le serveur backend
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname)); // Nom unique pour chaque fichier
  },
});

const upload = multer({ storage });

const transporter = nodemailer.createTransport({
  service: "Gmail",
  auth: {
    user: "diabyhamala0@gmail.com",
    pass: "AZERhd@001diab",
  },
});

const authenticateAdmin = async (req, res, next) => {
  const token = req.headers.authorization.split(" ")[1];
  if (!token) {
    return res.status(401).json({ message: "Authentification nécessaire" });
  }
  try {
    const decoded = jwt.verify(token, "token1");
    const user = await User.findOne({ email: decoded.email });
    if (!user) {
      return res.status(401).json({ message: "Utilisateur non trouvé" });
    }
    if (user.role !== "admin") {
      return res.status(403).json({ message: "Accès interdit" });
    }
    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Token invalide" });
  }
};
const authenticate = async (req, res, next) => {
  const token = req.headers.authorization.split(" ")[1];
  if (!token) {
    return res.status(401).json({ message: "Authentification nécessaire" });
  }
  try {
    const decoded = jwt.verify(token, "token1");
    const user = await User.findOne({ email: decoded.email });
    if (!user) {
      return res.status(401).json({ message: "Utilisateur non trouvé" });
    }
    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Token invalide" });
  }
};

app.post("/inscription", async (req, res) => {
  const { nom, email, mot_de_passe } = req.body;
  const user = await User.findOne({ email: email });
  if (user) {
    res.json("Cet utilisateur existe déjà !");
  } else {
    const a = await bcrypt.hash(mot_de_passe, 8, (err, hash) => {
      if (err) {
        res.json("Un problème est survenue...");
      } else {
        const new_user = User.create({
          nom,
          email,
          mot_de_passe: hash,
          commandes: [],
        });
        res.status(200).json("Inscription validée");
      }
    });
  }
});

app.post("/login", async (req, res) => {
  const { nom, email, mot_de_passe } = req.body;
  const user = await User.findOne({ email: email });
  if (user) {
    const isSame = await bcrypt.compare(mot_de_passe, user.mot_de_passe);
    if (isSame) {
      const authToken = await jwt.sign(
        {
          email: email,
          nom: user.nom,
          role: user.role,
        },
        "token1"
      );
      user.authTokens.push({ authToken });
      user.save();
      return res.json({
        token: authToken,
        user: { nom: user.nom, role: user.role },
      });
    } else {
      return res.json("Identifiant ou mot de passe invalide!!");
    }
  } else {
    return res.json("Identifiant ou mot de passe invalide!!");
  }
});

app.get("/list", async (req, res) => {
  const produits = await Product.find();
  res.status(200).json(produits);
});

app.post("/upload", upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).send("No file uploaded.");
  }
  const fileUrl = `${req.protocol}://${req.get("host")}/uploads/${
    req.file.filename
  }`;

  // Chemin d'URL pour l'image accessible depuis le frontend

  res.json({
    message: "File uploaded successfully!",
    fileUrl: fileUrl, // URL accessible depuis le frontend
  });
});

app.post("/send-email", async (req, res) => {
  const { prenom, nom, email, tel, objet, message } = req.body;
  console.log(email);
  const mailOptions = {
    from: email,
    to: "diabyhamala0@gmail.com",
    subject: objet,
    text: message,
  };

  try {
    try {
      await transporter.sendMail(mailOptions);
      res.status(200).json({ message: "E-mail envoyé avec succès !" });
    } catch (error) {
      console.error("Erreur lors de l'envoi de l'e-mail :", error);
      res.status(500).json({ message: "Erreur lors de l'envoi de l'e-mail." });
    }
  } catch (error) {
    console.error("Erreur lors de l'envoi de l'e-mail :", error);
    res.status(500).json({ message: "Erreur lors de l'envoi de l'e-mail." });
  }
});

app.post(
  "/produits",
  upload.single("image"),
  authenticateAdmin,
  async (req, res) => {
    const { id, category_id, title, img, promo, price, info, count, total } =
      req.body;
    const new_product = new Product({
      id,
      category_id,
      title,
      img,
      promo,
      price,
      info,
      count,
      total,
    });
    await new_product.save();
    res.status(201).json(new_product);
  }
);

app.delete("/produits/:id", authenticateAdmin, async (req, res) => {
  const { id } = req.params;
  await Product.deleteOne({ id: id });
  res.status(200).json({ message: "Produit supprimé avec succès" });
});

app.post("/produits/update/:id", authenticateAdmin, async (req, res) => {
  const ids = parseInt(req.params.id);
  console.log(ids);
  const { id, category_id, title, img, promo, price, info, count, total } =
    req.body;
  try {
    const produit = await Product.updateOne(
      { id: ids },
      {
        $set: { id, category_id, title, img, promo, price, info, count, total },
      }
    );
    res.status(200).json("Modification éffectuée avec succès");
  } catch (error) {
    res.status(400).json("Echec de la modification: " + error);
  }
});

function prixTotal(produits) {
  let total = 0;
  for (let i = 0; i < produits.length; i++) {
    if (produits[i].promo == 0) {
      total = total + produits[i].price * produits[i].count;
    } else {
      const price =
        produits[i].price - (produits[i].price * produits[i].promo) / 100;
      total = total + price * produits[i].count;
    }
  }
  console.log(produits);
  return total;
}

async function httpRequest(produits) {
  return prixTotal(produits);
}

app.post("/commande/ajouter", authenticate, async (req, res) => {
  const user = req.user;
  const ids = req.body.ids;
  const email = req.user.email;
  const produits = await User.find({ email: email }, { _id: 0, commandes: 1 });
  await httpRequest(produits[0].commandes).then((total) => {
    const commande = Commande.create({
      produits: produits[0].commandes,
      email_utilisateur: req.user.email,
      nom_utilisateur: req.user.nom,
      prix_total: total,
    });
  });

  const resultat = await fetch("http://localhost:4002/achats/delete", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${req.user.authTokens[0].authToken}`,
    },
  });
  const data = await resultat.json();
  res.status(200).json(user.commandes);
});

app.post("/commandes", async (req, res) => {
  const email = req.body.email;
  try {
    const commandes = await Commande.find({ email_utilisateur: email });
    res.status(200).json(commandes[0].produits);
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post("/commandelist", authenticate, async (req, res) => {
  const resultat = await fetch("http://localhost:4002/commandes", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: req.body.email,
    }),
  });
  const data = await resultat.json();
  console.log(data);
  const user = req.user;
  res.status(200).json(user.commandes);
});

app.post("/achats", authenticate, async (req, res) => {
  const user = req.user;
  const commandes = req.body;
  const add = await User.updateOne(
    { email: user.email },
    { $addToSet: { commandes: commandes } }
  );
  res.status(200).json(add);
});

app.post("/achats/augmenter/:id", authenticate, async (req, res) => {
  const id = parseInt(req.params.id);
  console.log(id);
  const user = req.user;
  const add = await User.updateOne(
    { email: user.email, "commandes.id": id },
    { $inc: { "commandes.$.count": 1 } }
  );
  res.status(200).json(add);
});

app.post("/achats/decrementer/:id", authenticate, async (req, res) => {
  const id = parseInt(req.params.id);
  console.log(id);
  const user = req.user;
  const dec = await User.updateOne(
    { email: user.email, "commandes.id": id },
    { $inc: { "commandes.$.count": -1 } }
  );
  res.status(200).json(dec);
});

app.post("/achats/supprimer/:id", authenticate, async (req, res) => {
  const id = parseInt(req.params.id);
  console.log(id);
  const user = req.user;
  const supp = await User.updateOne(
    { email: user.email },
    { $pull: { commandes: { id: id } } }
  );
  res.status(200).json(supp);
});

app.post("/achats/delete", authenticate, async (req, res) => {
  const user = req.user;
  const supp = await User.updateOne(
    { email: user.email },
    { $set: { commandes: [] } }
  );
  res.status(200).json(supp);
});

app.post("/lescommandes", authenticateAdmin, async (req, res) => {
  const commandes = await Commande.find();
  res.status(200).json(commandes);
});

app.post("/deletecommande/:id", authenticateAdmin, async (req, res) => {
  const id = req.params.id;
  console.log(id);
  const delc = await Commande.deleteMany({ _id: id });
  const commandes = await Commande.find();
  res.status(200).json(commandes);
});

app.post("/utilisateurs", authenticateAdmin, async (req, res) => {
  const users = await User.find({ role: "user" }, { _id: 0, nom: 1, email: 1 });
  res.status(200).json(users);
});

app.post("/deleteUser/:email", authenticateAdmin, async (req, res) => {
  const email = req.params.email;
  try {
    const deleted = await User.deleteOne({ email: email });
    res.status(200).json("Utilisateur supprimer avec succès");
  } catch (error) {
    res.status(404).json("Echec");
  }
});

app.post("/deleteCompte/:email", authenticate, async (req, res) => {
  const email = req.params.email;
  try {
    const deleted = await User.deleteOne({ email: email });
    res.status(200).json("Compte supprimer avec succès");
  } catch (error) {
    res.status(404).json("Echec");
  }
});

app.post("/updateUser/:email", authenticateAdmin, async (req, res) => {
  const email = req.params.email;
  const { nom, mot_de_passe } = req.body;

  try {
    const user = await User.findOne({ email: email });

    if (user) {
      const hash = await bcrypt.hash(mot_de_passe, 8);
      await User.updateOne(
        { email: email },
        { $set: { nom: nom, email: email, mot_de_passe: hash } }
      );
      res.status(200).json("Utilisateur modifié avec succès!");
    } else {
      res.status(404).json("Utilisateur non trouvé.");
    }
  } catch (error) {
    res.status(500).json("Un problème est survenu...");
  }
});

app.post("/userUpdate/:email", authenticate, async (req, res) => {
  const email = req.params.email;
  const { nom, mot_de_passe } = req.body;

  try {
    const user = await User.findOne({ email: email });

    if (user) {
      const hash = await bcrypt.hash(mot_de_passe, 8);
      await User.updateOne(
        { email: email },
        { $set: { nom: nom, email: email, mot_de_passe: hash } }
      );
      res.status(200).json("Compte modifié avec succès!");
    } else {
      res.status(404).json("Compte non trouvé.");
    }
  } catch (error) {
    res.status(500).json("Un problème est survenu...");
  }
});

app.get("/moncompte", authenticate, async (req, res) => {
  const user = req.user;
  const nom = req.user.nom;
  const email = req.user.email;
  res.status(200).json({ nom, email });
});

app.listen(4002, () => {
  console.log("en écoute...");
});
