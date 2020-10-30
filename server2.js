const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const cookieparser = require('cookie-parser');
const path = require('path');
const app = express();
const Memcached = require('memcached');
const memcached = new Memcached();

memcached.connect('localhost:12345', async function( err, conn ){
  if( err ) {
      console.log( conn.server,'error while memcached connection!!');
  };
  console.log('connecté au serveur memcached');
});

async function getTodoList() {
    return new Promise((resolve, reject) => {
        memcached.get('todos', function(err, data) {
            resolve(data);
        });
    });
};

app
    .use(bodyParser.raw())
    .use(bodyParser.urlencoded({ extended: true }))
    .use(session({
        secret: 'todotopsecret'
    }))
    .use(cookieparser())
    .use(async (req, res, next) => {
        const todos = await getTodoList();
        if (typeof todos === 'undefined' || !todos.length) {
            memcached.set('todos', [], 10000, function(err, data) {

            });
        }
        next();
    })
    .use(express.static(__dirname + path.sep + 'public'));


app.post('/todo/ajouter', async (req, res) => {
    if (req.body.newtodo !== '') {
        let todos = await getTodoList();
        if (!todos.some(todo => todo.name.trim() === req.body.newtodo.trim())) {
            const positions = todos.map(todo => todo.position);
            const position = !!positions.length ? Math.max(...positions) + 1 : 0;
            todos.push({name: req.body.newtodo.trim(), position});
            memcached.set('todos', todos, 10000, function(err, data) {});
        };
    }
    res.redirect('/todo');
});

app.post('/todo/modifier', async(req, res) => {
    if (req.body.newVal && req.body.id) {
        let todos = await getTodoList();
        todos = todos.map((todo, index) => {
            if (index.toString() === req.body.id.toString() && !todos.find(todo => todo.name.trim() === req.body.newVal.trim())) {
                todo.name = req.body.newVal.trim();
            };
            return todo;
        });
        console.log('todos', todos);
        memcached.set('todos', todos, 10000, function(err, data) {});
        res.redirect('/todo');
    };
});

app.post('/todo/positioning', async(req, res) => {
    const newTodos = req.body.newTodos;
    let todos = await getTodoList();
    todos = todos.map(todo => {
        const found = newTodos.find(nTodo => nTodo.name === todo.name);
        todo.position = parseInt(todo.position);
        if (todo.name === found.name) {
            return found;
        };
        return todo;
    });
    todos.sort((a, b) => parseInt(a.position) - parseInt(b.position));
    memcached.set('todos', todos, 10000, function(err, data) {});
    res.redirect('/todo');
});

app.get('/todo/supprimer/:id', async (req, res, next) => {
    let todos = await getTodoList();
    todos = todos.filter((key, value) => value.toString() !== req.params.id.toString()).map((todo, index) => {
        todo.position = index;
        return todo;
    });
    memcached.set('todos', todos, 10000, function(err, data) {});
    res.redirect('/todo');
});

app.get('/todo', async function(req, res) {
    const todos = await getTodoList();
    res.render('todo.ejs', { todolist: todos });
});

app.get('/', async function(req, res) {
    res.redirect('/todo');
})

app.listen(3001, () => console.log('done'));