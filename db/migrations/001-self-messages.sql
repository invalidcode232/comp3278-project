-- Apply once to an existing baseline database; fresh installs use schema.sql.
-- Allow the same user to occupy the sender and recipient roles.
ALTER TABLE messages DROP CHECK chk_messages_not_self;
