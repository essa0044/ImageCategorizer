-- db_init/init.sql
CREATE TABLE IF NOT EXISTS category (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    color VARCHAR(7) NOT NULL -- HEX Color like #FFFFFF
);

CREATE TABLE IF NOT EXISTS category_parent (
    childCategoryId INTEGER NOT NULL,
    parentCategoryId INTEGER NOT NULL,
    PRIMARY KEY (childCategoryId, parentCategoryId),
    FOREIGN KEY (childCategoryId) REFERENCES category(id) ON DELETE CASCADE,
    FOREIGN KEY (parentCategoryId) REFERENCES category(id) ON DELETE CASCADE
);

-- dummy-categories
INSERT INTO category (name, color) VALUES
('Question Block', '#FFD700'),
('Answer Area', '#ADD8E6'),
('Marking Space', '#90EE90'),
('Metadata', '#D3D3D3');