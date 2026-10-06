"""Migrations reuse the owned connection, including startup WAL/foreign keys."""

from alembic import context

from music_api.database import Base


connection = context.config.attributes["connection"]
context.configure(connection=connection, target_metadata=Base.metadata, render_as_batch=True, transactional_ddl=True)
with context.begin_transaction():
    context.run_migrations()
