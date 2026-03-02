import logging
import os
import sys

# Cache handlers to avoid re-creating them
_handlers = {}


def get_file_handler(
    log_name: str, level: int, formatter: logging.Formatter, save_path: str = None
):
    if save_path is None:
        # Get the absolute path to the backend directory
        backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        save_path = os.path.join(backend_dir, "logs")

    os.makedirs(save_path, exist_ok=True)
    full_path = os.path.join(save_path, log_name)

    # Use cache to return the same handler for the same file
    if full_path in _handlers:
        return _handlers[full_path]

    file_handler = logging.FileHandler(filename=full_path, mode="a", encoding="utf-8")
    file_handler.setLevel(level)
    file_handler.setFormatter(formatter)
    _handlers[full_path] = file_handler
    return file_handler


def config_logger(logger: logging.Logger):
    # If this logger already has handlers, don't add more
    if logger.handlers:
        return logger

    # We want to avoid adding handlers to every sub-logger if they already propagate to a parent with handlers.
    # But since we are calling this for each module logger, we should check if any parent has handlers.
    temp_logger = logger
    while temp_logger:
        if temp_logger.handlers:
            return logger
        if not temp_logger.propagate:
            break
        temp_logger = temp_logger.parent

    formatter = logging.Formatter(
        "[pid=%(process)s] - [%(asctime)s] - [%(name)s] - [%(levelname)s] - [%(message)s]"
    )

    # Console Handler (Shared)
    if "console" not in _handlers:
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setLevel(logging.INFO)
        console_handler.setFormatter(formatter)
        _handlers["console"] = console_handler

    logger.addHandler(_handlers["console"])

    # File Handler (Shared)
    debug_handler = get_file_handler(
        log_name="debug.log", level=logging.DEBUG, formatter=formatter
    )
    logger.addHandler(debug_handler)

    logger.setLevel(logging.DEBUG)
    return logger


def logger(name: str):
    return config_logger(logging.getLogger(name))
