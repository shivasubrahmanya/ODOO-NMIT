-- Sample data for SynergySphere
USE synergysphere;

-- Sample users
INSERT INTO users (username, email, full_name, hashed_password, role, is_active) VALUES
('johndoe', 'john@example.com', 'John Doe', '$2b$12$sample_hashed_password_1', 'ADMIN', 1),
('janesmith', 'jane@example.com', 'Jane Smith', '$2b$12$sample_hashed_password_2', 'MEMBER', 1),
('bobjohnson', 'bob@example.com', 'Bob Johnson', '$2b$12$sample_hashed_password_3', 'MEMBER', 1),
('alicebrown', 'alice@example.com', 'Alice Brown', '$2b$12$sample_hashed_password_4', 'MEMBER', 1);

-- Sample projects
INSERT INTO projects (name, description, owner_id) VALUES
('Website Redesign', 'Complete redesign of company website with modern UI/UX', 1),
('Mobile App Development', 'Build iOS and Android mobile application', 1),
('Marketing Campaign', 'Q4 marketing campaign planning and execution', 2);

-- Project members
INSERT INTO project_members (project_id, user_id, role) VALUES
(1, 1, 'owner'),
(1, 2, 'admin'),
(1, 3, 'member'),
(2, 1, 'owner'),
(2, 4, 'member'),
(3, 2, 'owner'),
(3, 3, 'member'),
(3, 4, 'member');

-- Sample tasks
INSERT INTO tasks (project_id, title, description, assignee_id, due_date, status, created_by) VALUES
(1, 'Design Homepage', 'Create wireframes and mockups for the homepage', 2, '2025-10-15', 'in_progress', 1),
(1, 'Develop Navigation', 'Implement responsive navigation menu', 3, '2025-10-10', 'todo', 1),
(1, 'Content Migration', 'Migrate existing content to new structure', 2, '2025-10-20', 'todo', 1),
(2, 'Setup Development Environment', 'Configure React Native development setup', 4, '2025-09-15', 'done', 1),
(2, 'Design App Icons', 'Create application icons for iOS and Android', 4, '2025-09-25', 'in_progress', 1),
(3, 'Market Research', 'Analyze competitor strategies and market trends', 3, '2025-09-30', 'todo', 2),
(3, 'Create Campaign Strategy', 'Develop comprehensive marketing strategy', 4, '2025-10-05', 'todo', 2);

-- Sample comments
INSERT INTO comments (project_id, task_id, author_id, content) VALUES
(1, NULL, 1, 'Great progress on the website redesign project everyone!'),
(1, NULL, 2, 'Thanks! The new design is looking really modern.'),
(NULL, 1, 2, 'I have completed the initial wireframes. Ready for review.'),
(NULL, 1, 1, 'Looks excellent! Please proceed with the high-fidelity mockups.'),
(NULL, 4, 4, 'Development environment is set up and ready to go.'),
(NULL, 5, 4, 'Working on the icon designs. Should have drafts by end of week.');

-- Sample notifications
INSERT INTO notifications (user_id, project_id, task_id, title, body, is_read) VALUES
(2, 1, 1, 'Task Assigned', 'You have been assigned to "Design Homepage"', FALSE),
(3, 1, 2, 'Task Assigned', 'You have been assigned to "Develop Navigation"', FALSE),
(4, 2, 4, 'Task Completed', 'Task "Setup Development Environment" has been marked as done', TRUE),
(1, 1, NULL, 'New Comment', 'New comment added to Website Redesign project', FALSE),
(2, NULL, 1, 'Deadline Reminder', 'Task "Design Homepage" is due in 3 days', FALSE);
