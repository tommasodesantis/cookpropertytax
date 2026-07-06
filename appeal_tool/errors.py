class AppealToolError(Exception):
    """Base exception for user-facing failures."""


class UserInputError(AppealToolError):
    """The user supplied invalid or incomplete input."""


class DataAccessError(AppealToolError):
    """A data source failed or returned unusable data."""


class NotFoundError(AppealToolError):
    """The requested parcel or address was not found."""
