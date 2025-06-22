import express from "express";
import { createConnection } from "mysql2/promise";

const app = express();
const PORT = 3000;

const DB_CONFIG = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PWD,
    database: process.env.DB_DATA
};

let dbConnection;

const MAX_DB_RETRIES = 3;

async function establishDbConnection(attempt = 1) {
    if (attempt > MAX_DB_RETRIES) {
        console.error('Max database connection retries reached. Exiting Node.js application.');
        process.exit(1);
    }

    try {
        console.log(`Attempting to connect to MySQL (Attempt ${attempt}/${MAX_DB_RETRIES})...`);
        dbConnection = await createConnection(DB_CONFIG);
        console.log('Successfully connected to DB.');
    } catch (err) {
        console.error(`Error connecting to database (Attempt ${attempt}):`, err.message);
        const retryConditions = ['ECONNREFUSED', 'ER_ACCESS_DENIED_ERROR', 'PROTOCOL_CONNECTION_LOST'];
        if (retryConditions.includes(err.code) || err.message.includes('connect ECONNREFUSED')) {
            console.log(`Retrying connection in ${DB_RETRY_DELAY_MS / 1000} seconds...`);
            setTimeout(() => establishDbConnection(attempt + 1), DB_RETRY_DELAY_MS);
        } else {
            console.error('Fatal database error, not retrying:', err);
            process.exit(1);
        }
    }
}

async function insertPerson(name) {
    if (!dbConnection) {
        throw new Error("Database connection not established.");
    }
    await dbConnection.execute('INSERT INTO people (name) VALUES (?)', [name.trim()]);
    console.log(`Name "${name.trim()}" cadastrado.`);
}

async function getAllPeopleNames() {
    if (!dbConnection) {
        throw new Error("Database connection not established.");
    }
    const [rows] = await dbConnection.execute('SELECT name FROM people');
    return rows.map(row => row.name);
}

function generatePeopleListHtml(names) {
    const peopleListItems = names.length > 0
        ? names.map(name => `<li>${name}</li>`).join('')
        : '<li>Nenhum nome cadastrado ainda.</li>';

    return `
        <h2>Nomes cadastrados:</h2>
        <ul>
            ${peopleListItems}
        </ul>
    `;
}

function generatePromptScript() {
    return `
        <script>
            const user = prompt("Por favor, digite seu nome para cadastrar:");
            if (user !== null && user.trim() !== '') {
                window.location.href = "/?name=" + encodeURIComponent(user);
            } else if (user !== null) {
                alert("O nome não pode ser vazio. Por favor, tente novamente.");
                window.location.href = "/";
            }
        </script>
    `;
}


app.get('/', async (req, res) => {
    if (!dbConnection) {
        return res.status(503).send('<h1>Serviço Indisponível</h1><p>Aguardando conexão com o banco de dados...</p>');
    }

    const userName = req.query.name;
    let htmlContent = ""

    try {
        if (userName && userName.trim() !== '') {
            await insertPerson(userName);
        } else {
            htmlContent += generatePromptScript();
        }

        const peopleNames = await getAllPeopleNames();
        htmlContent += generatePeopleListHtml(peopleNames);

        res.send(htmlContent);

    } catch (error) {
        console.error('Error processing request:', error.message);
        res.status(500).send(`
            <h1>Algo deu errado!</h1>
            <p>Não foi possível processar sua requisição ou acessar o banco de dados.</p>
            <pre><code>${error.message || error}</code></pre>
            <p><a href="/">Tentar novamente</a></p>
        `);
    }
});

app.listen(PORT, () => {
    console.log(`App running on port: ${PORT}`);
    establishDbConnection();
});
