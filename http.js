const express = require("express");
const app = express();
const axios = require ("axios")

axios.get("https://opusdeco.ru/#");

app.listen(2400, () => {
    console.log()
})