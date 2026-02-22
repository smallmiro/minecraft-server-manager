FROM mcr.microsoft.com/devcontainers/base:ubuntu-24.04

RUN curl -fsSL https://deb.nodesource.com/setup_lts.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

RUN apt-get update && apt-get install -y \
    git curl jq ripgrep fd-find tmux locales \
    && mkdir -p -m 755 /etc/apt/keyrings \
    && curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
       | tee /etc/apt/keyrings/githubcli-archive-keyring.gpg > /dev/null \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
       | tee /etc/apt/sources.list.d/github-cli.list > /dev/null \
    && apt-get update && apt-get install -y gh \
    && rm -rf /var/lib/apt/lists/* \
    && locale-gen en_US.UTF-8

ENV LANG=en_US.UTF-8
ENV LC_ALL=en_US.UTF-8
ENV TERM=xterm-256color

RUN mkdir -p /home/vscode/.claude/plugins /home/vscode/.local/bin \
    && chown -R vscode:vscode /home/vscode/.claude /home/vscode/.local

# 인증 파일 복사
COPY .claude-auth/settings.json /home/vscode/.claude/settings.json
COPY .claude-auth/.credentials.json /home/vscode/.claude/.credentials.json
COPY .claude-auth/claude.json /home/vscode/.claude.json

RUN chown -R vscode:vscode /home/vscode/.claude /home/vscode/.claude.json

USER vscode

RUN curl -fsSL https://claude.ai/install.sh | bash

RUN echo 'set -g default-terminal "tmux-256color"' > /home/vscode/.tmux.conf \
    && echo 'set -ga terminal-overrides ",xterm-256color:Tc"' >> /home/vscode/.tmux.conf \
    && echo 'set -g mouse on' >> /home/vscode/.tmux.conf
