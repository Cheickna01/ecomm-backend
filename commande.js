const mongoose = require("mongoose")
const Schema = mongoose.Schema

const CommandeSchema = new Schema({
    produits: {
        type: Array,
    },
    email_utilisateur: String,
    nom_utilisateur: String,
    prix_total: Number,
    created_at: {
        type: Date,
        default: Date.now()
    },
})

const Commande = mongoose.model("commande",CommandeSchema)
module.exports = Commande