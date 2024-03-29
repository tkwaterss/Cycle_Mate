require('dotenv').config();
const {CONNECTION_STRING} = process.env;
const path = require('path');

const Sequelize = require('sequelize');

const sequelize = new Sequelize(CONNECTION_STRING, {
    dialect: 'postgres',
    dialectOptions: {
        ssl: {
            rejectUnauthorized: false
        }
    }
})

module.exports = {
loadPage: (req, res) => {
    res.status(200).sendFile(path.join(__dirname, '../public/ticketView.html'))
},
searchTickets: (req, res) => {
    let {value, status} = req.query;
    let queryStatus = `AND s.status LIKE '%${status}%'`
    if(status === 'All Tickets') {
        queryStatus = ''
    }
    sequelize.query(`
    SELECT s.status, c.firstname, c.lastname, c.phone, t.due_date, t.ticket_id
    FROM tickets AS t
        JOIN clients AS c
        ON t.client_id = c.client_id
        JOIN statuses AS s
        ON t.status_id = s.status_id
    WHERE c.firstname LIKE '%${value}%' ${queryStatus} AND t.due_date >= CURRENT_DATE
    GROUP BY t.ticket_id, c.firstname, c.lastname, c.phone, s.status
    ORDER BY t.due_date
    LIMIT 10;
    `).then(dbRes => {
        if(dbRes[0][0]) {
            res.status(200).send(dbRes[0])
        } else {
            sequelize.query(`
            SELECT c.firstname, c.lastname, c.phone, t.due_date, t.ticket_id, s.status
            FROM tickets AS t
                JOIN clients AS c
                ON t.client_id = c.client_id
                JOIN statuses AS s
                ON t.status_id = s.status_id
                WHERE t.due_date >= CURRENT_DATE
            GROUP BY t.ticket_id, c.firstname, c.lastname, c.phone, s.status
            ORDER BY t.due_date
            LIMIT 10;
            `).then(dbRes => res.status(200).send(dbRes[0]))
            .catch(err => console.log(err))
        }
    })
    .catch(err => console.log(err))
},
addNewTicket: (req, res) => {
    const {firstname, lastname, phone, email, brand, model, color, size, description, dueDate} = req.body;
    sequelize.query(`
        SELECT phone
        FROM clients
        WHERE phone = '${phone}';
    `).then(dbRes => {
        console.log(dbRes[0][0])
        if(dbRes[0][0]) {
            sequelize.query(`
                SELECT c.client_id, b.bike_id
                FROM clients AS c
                JOIN bikes AS b
                ON c.client_id = b.client_id
                WHERE c.phone = '${phone}';
            `).then(dbRes => {
                const {client_id, bike_id} = dbRes[0][0];
                sequelize.query(`
                    INSERT INTO tickets (client_id, bike_id, status_id, due_date, description)
                    VALUES (${client_id}, ${bike_id}, 1, '${dueDate}', '${description}');  
                `).then(dbRes => {
                    res.sendStatus(200)
                }).catch(err => console.log(err))
            }).catch(err => console.log(err))
        } else {
            console.log('phone does not exist')
            sequelize.query(`
                INSERT INTO clients (firstname, lastname, phone, email)
                VALUES ('${firstname}', '${lastname}', '${phone}', '${email}');

                SELECT MAX(client_id) AS client_id
                FROM clients;
            `).then(dbRes => {
                const {client_id} = dbRes[0][0];
                sequelize.query(`
                    INSERT INTO bikes (client_id, brand, model, color, size)
                    VALUES ('${client_id}', '${brand}', '${model}', '${color}', '${size}');

                    SELECT MAX(bike_id) AS bike_id
                    FROM bikes;
                `).then(dbRes => {
                    const {bike_id} = dbRes[0][0];
                    sequelize.query(`
                        INSERT INTO tickets (client_id, bike_id, status_id, due_date, description)
                        VALUES (${client_id}, ${bike_id}, 1, '${dueDate}', '${description}');
                    `).then(dbRes => {
                        res.sendStatus(200)
                    }).catch(err => console.log(err))
                }).catch(err => console.log(err))
            }).catch(err => console.log(err))
        }
    }).catch(err => console.log(err))
},
getRecentTicket: (req, res) => {
    sequelize.query(`
    SELECT t.ticket_id, s.status, c.firstname, c.lastname, c.phone, c.email, b.brand, b.model, b.color, b.size, t.due_date, t.description
    FROM tickets AS t
        JOIN statuses AS s
        ON t.status_id = s.status_id
        JOIN clients AS c
        ON t.client_id = c.client_id
        JOIN bikes AS b
        ON c.client_id = b.client_id
    WHERE t.ticket_id IN (
        SELECT MAX(ticket_id) AS ticket_id
        FROM tickets
        )
    GROUP BY t.ticket_id, s.status, c.firstname, c.lastname, c.phone, c.email, b.brand, b.model, b.color, b.size, t.due_date, t.description;

    SELECT SUM(i.price) AS total_price
    FROM tickets AS t
        JOIN tickets_items AS ti
        ON t.ticket_id = ti.ticket_id
        JOIN items AS i
        ON ti.item_id = i.item_id
    WHERE t.ticket_id IN (
        SELECT MAX(ticket_id) AS ticket_id
        FROM tickets
        );
    `).then(dbRes => {
        console.log(dbRes[0])
        res.status(200).send(dbRes[0])
    }).catch(err => console.log(err))
},
getSideTickets: (req, res) => {
    sequelize.query(`
        SELECT c.firstname, c.lastname, c.phone, t.due_date, t.ticket_id, s.status
        FROM tickets AS t
            JOIN clients AS c
            ON t.client_id = c.client_id
            JOIN statuses AS s
            ON t.status_id = s.status_id
        WHERE t.due_date >= CURRENT_DATE
        GROUP BY t.ticket_id, c.firstname, c.lastname, c.phone, s.status
        ORDER BY t.due_date
        LIMIT 10;
    `).then(dbRes => res.status(200).send(dbRes[0]))
    .catch(err => console.log(err))
},
getTicketById: (req, res) => {
    const {ticketId} = req.query
    sequelize.query(`
    SELECT t.ticket_id, s.status, c.firstname, c.lastname, c.phone, c.email, b.brand, b.model, b.color, b.size, t.due_date, t.description
    FROM tickets AS t
        JOIN statuses AS s
        ON t.status_id = s.status_id
        JOIN clients AS c
        ON t.client_id = c.client_id
        JOIN bikes AS b
        ON c.client_id = b.client_id
        WHERE t.ticket_id = ${ticketId}
    GROUP BY t.ticket_id, s.status, c.firstname, c.lastname, c.phone, c.email, b.brand, b.model, b.color, b.size, t.due_date, t.description;

    SELECT SUM(i.price) AS total_price
    FROM tickets AS t
        JOIN tickets_items AS ti
        ON t.ticket_id = ti.ticket_id
        JOIN items AS i
        ON ti.item_id = i.item_id
    WHERE t.ticket_id = ${ticketId};
    `).then(dbRes => {
        console.log(dbRes[0])
        res.status(200).send(dbRes[0])
    })
},
getTicketItems: (req, res) => {
    const {ticketId} = req.query
    sequelize.query(`
        SELECT i.*, ti.ticket_item_id
        FROM items AS i
        JOIN tickets_items AS ti
        ON i.item_id = ti.item_id
        JOIN tickets AS t
        ON t.ticket_id = ti.ticket_id
        WHERE t.ticket_id = ${ticketId};
    `).then(dbRes => {
        res.status(200).send(dbRes[0])
    }).catch(err => console.log(err))
},
deleteTicketItem: (req, res) => {
    const {targetId, ticketId} = req.query
    sequelize.query(`
        DELETE FROM tickets_items
        WHERE ticket_item_id = ${targetId};

        SELECT i.*, ti.ticket_item_id
        FROM items AS i
        JOIN tickets_items AS ti
        ON i.item_id = ti.item_id
        JOIN tickets AS t
        ON t.ticket_id = ti.ticket_id
        WHERE t.ticket_id = ${ticketId};
    `).then(dbRes => {
        res.status(200).send(dbRes[0])
    }).catch(err=> console.log(err))
},
updateTicket: (req, res) => {
    const {ticketId, description, dueDate, status} = req.body
    let status_id
    if (status === 'Checked In') {
        status_id = 1;
    } else if (status === 'In Progress') {
        status_id = 2;
    } else if (status === 'Work Complete') {
        status_id = 3;
    } else if (status === 'Paid in Full') {
        status_id = 4;
    }

    sequelize.query(`
        UPDATE tickets
        SET description = '${description}' 
        WHERE ticket_id = ${ticketId};

        UPDATE tickets
        SET due_date = '${dueDate}'
        WHERE ticket_id = ${ticketId};

        UPDATE tickets
        SET status_id = ${status_id}
        WHERE ticket_id = ${ticketId};
        
        SELECT t.ticket_id, s.status, c.firstname, c.lastname, c.phone, c.email, b.brand, b.model, b.color, b.size, t.due_date, t.description
        FROM tickets AS t
            JOIN statuses AS s
            ON t.status_id = s.status_id
            JOIN clients AS c
            ON t.client_id = c.client_id
            JOIN bikes AS b
            ON c.client_id = b.client_id
            WHERE t.ticket_id = ${ticketId}
        GROUP BY t.ticket_id, s.status, c.firstname, c.lastname, c.phone, c.email, b.brand, b.model, b.color, b.size, t.due_date, t.description;

        SELECT SUM(i.price) AS total_price
        FROM tickets AS t
            JOIN tickets_items AS ti
            ON t.ticket_id = ti.ticket_id
            JOIN items AS i
            ON ti.item_id = i.item_id
        WHERE t.ticket_id = ${ticketId};
    `).then(dbRes => {
        res.status(200).send(dbRes[0])
    }).catch(err => console.log(err))
},
searchItems: (req, res) => {
    const {searchWord} = req.query
    sequelize.query(`
        SELECT *
        FROM items
        WHERE title LIKE '%${searchWord}%';
    `).then(dbRes => {
        res.status(200).send(dbRes[0])
    }).catch(err => console.log(err))
},
addNewItem: (req, res) => {
    const {ticketId, newItemInput, newItemPrice} = req.body
    sequelize.query(`
        INSERT INTO items (title, price)
        VALUES('${newItemInput}', ${newItemPrice});
        
        SELECT MAX(item_id) AS item_id
        FROM items;
    `).then(dbRes => {
        const {item_id} = dbRes[0][0]
        sequelize.query(`
            INSERT INTO tickets_items (ticket_id, item_id)
            VALUES(${ticketId}, ${item_id});

            SELECT i.*, ti.ticket_item_id
            FROM items AS i
            JOIN tickets_items AS ti
            ON i.item_id = ti.item_id
            JOIN tickets AS t
            ON t.ticket_id = ti.ticket_id
            WHERE t.ticket_id = ${ticketId};
        `).then(dbRes => {
            res.status(200).send(dbRes[0])
        }).catch(err => console.log(err))
    })
},
addTicketItem: (req, res) => {
    const {targetId, ticketId} = req.query
    sequelize.query(`
        INSERT INTO tickets_items (ticket_id, item_id)
        VALUES(${ticketId}, ${targetId});

        SELECT i.*, ti.ticket_item_id
        FROM items AS i
        JOIN tickets_items AS ti
        ON i.item_id = ti.item_id
        JOIN tickets AS t
        ON t.ticket_id = ti.ticket_id
        WHERE t.ticket_id = ${ticketId};
    `).then(dbRes => {
        res.status(200).send(dbRes[0])
    }).catch(err=> console.log(err))
},
deleteTicket: (req, res) => {
    const {targetId} = req.query
    sequelize.query(`
        DELETE FROM tickets_items
        WHERE ticket_id = ${targetId};
        
        DELETE FROM tickets
        WHERE ticket_id = ${targetId};

        SELECT t.ticket_id, s.status, c.firstname, c.lastname, c.phone, c.email, b.brand, b.model, b.color, b.size, t.due_date, t.description
        FROM tickets AS t
            JOIN statuses AS s
            ON t.status_id = s.status_id
            JOIN clients AS c
            ON t.client_id = c.client_id
            JOIN bikes AS b
            ON c.client_id = b.client_id
        WHERE t.ticket_id IN (
            SELECT MAX(ticket_id) AS ticket_id
            FROM tickets
            )
        GROUP BY t.ticket_id, s.status, c.firstname, c.lastname, c.phone, c.email, b.brand, b.model, b.color, b.size, t.due_date, t.description;

        SELECT SUM(i.price) AS total_price
        FROM tickets AS t
            JOIN tickets_items AS ti
            ON t.ticket_id = ti.ticket_id
            JOIN items AS i
            ON ti.item_id = i.item_id
        WHERE t.ticket_id IN (
            SELECT MAX(ticket_id) AS ticket_id
            FROM tickets
            );
    `).then(dbRes => {
        res.status(200).send(dbRes[0])
    }).catch(err => console.log(err))
},
editTicket: (req, res) => {
    const {firstname, lastname, phone, email, brand, model, color, size} = req.body
    const {targetId} = req.query
    sequelize.query(`
        SELECT client_id, bike_id
        FROM tickets
        WHERE ticket_id = ${targetId};
    `).then(dbRes => {
        const {client_id, bike_id} = dbRes[0][0]
        sequelize.query(`
            UPDATE clients
            SET firstname = '${firstname}', lastname = '${lastname}', phone = '${phone}', email = '${email}'
            WHERE client_id = ${client_id};
            
            UPDATE bikes
            SET brand = '${brand}', model = '${model}', color = '${color}', size = '${size}'
            WHERE bike_id = ${bike_id};

            SELECT t.ticket_id, s.status, c.firstname, c.lastname, c.phone, c.email, b.brand, b.model, b.color, b.size, t.due_date, t.description
            FROM tickets AS t
                JOIN statuses AS s
                ON t.status_id = s.status_id
                JOIN clients AS c
                ON t.client_id = c.client_id
                JOIN bikes AS b
                ON c.client_id = b.client_id
                WHERE t.ticket_id = ${targetId}
            GROUP BY t.ticket_id, s.status, c.firstname, c.lastname, c.phone, c.email, b.brand, b.model, b.color, b.size, t.due_date, t.description;

            SELECT SUM(i.price) AS total_price
            FROM tickets AS t
                JOIN tickets_items AS ti
                ON t.ticket_id = ti.ticket_id
                JOIN items AS i
                ON ti.item_id = i.item_id
            WHERE t.ticket_id = ${targetId};
        `).then(dbRes => {
            res.status(200).send(dbRes[0])
        }).catch(err => console.log(err))
    }).catch(err => console.log(err))
}
}