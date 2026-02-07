FROM mcr.microsoft.com/devcontainers/base:ubuntu-24.04

RUN curl -fsSL https://deb.nodesource.com/setup_lts.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

RUN apt-get update && apt-get install -y \
    git curl jq ripgrep fd-find tmux locales \
    && rm -rf /var/lib/apt/lists/* \
    && locale-gen en_US.UTF-8

ENV LANG=en_US.UTF-8
ENV LC_ALL=en_US.UTF-8
ENV TERM=xterm-256color

RUN mkdir -p /home/vscode/.claude /home/vscode/.local/bin \
    && chown -R vscode:vscode /home/vscode/.claude /home/vscode/.local

USER vscode

RUN curl -fsSL https://claude.ai/install.sh | bash

RUN echo 'set -g default-terminal "tmux-256color"' > /home/vscode/.tmux.conf \
    && echo 'set -ga terminal-overrides ",xterm-256color:Tc"' >> /home/vscode/.tmux.conf
