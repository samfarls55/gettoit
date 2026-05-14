FROM node:20

ARG TZ
ENV TZ="$TZ"

ARG CLAUDE_CODE_VERSION=latest

# Install basic development tools and iptables/ipset
RUN apt-get update && apt-get install -y --no-install-recommends \
  less \
  git \
  procps \
  sudo \
  fzf \
  zsh \
  man-db \
  unzip \
  gnupg2 \
  gh \
  iptables \
  ipset \
  iproute2 \
  dnsutils \
  aggregate \
  jq \
  nano \
  vim \
  && apt-get clean && rm -rf /var/lib/apt/lists/*

# Ensure default node user has access to /usr/local/share
RUN mkdir -p /usr/local/share/npm-global && \
  chown -R node:node /usr/local/share

ARG USERNAME=node

# Persist bash history.
RUN SNIPPET="export PROMPT_COMMAND='history -a' && export HISTFILE=/commandhistory/.bash_history" \
  && mkdir /commandhistory \
  && touch /commandhistory/.bash_history \
  && chown -R $USERNAME /commandhistory

# Set `DEVCONTAINER` environment variable to help with orientation
ENV DEVCONTAINER=true

# Create workspace and config directories and set permissions
RUN mkdir -p /workspace /home/node/.claude && \
  chown -R node:node /workspace /home/node/.claude

WORKDIR /workspace

ARG GIT_DELTA_VERSION=0.18.2
RUN ARCH=$(dpkg --print-architecture) && \
  wget "https://github.com/dandavison/delta/releases/download/${GIT_DELTA_VERSION}/git-delta_${GIT_DELTA_VERSION}_${ARCH}.deb" && \
  sudo dpkg -i "git-delta_${GIT_DELTA_VERSION}_${ARCH}.deb" && \
  rm "git-delta_${GIT_DELTA_VERSION}_${ARCH}.deb"

# Use bash for all remaining RUN steps that need advanced shell features
SHELL ["/bin/bash", "-c"]

# Swift toolchain (Linux) — for sourcekit-lsp, swift-format, syntax checks on non-UI code
ARG SWIFT_VERSION=5.10
RUN ARCH=$(dpkg --print-architecture) \
    && SWIFT_PLATFORM=ubuntu22.04 \
    && SWIFT_PLATFORM_DIR=ubuntu2204 \
    && if [ "$ARCH" = "arm64" ]; then \
         SWIFT_PLATFORM=ubuntu22.04-aarch64; \
         SWIFT_PLATFORM_DIR=ubuntu2204-aarch64; \
       fi \
    && wget -q "https://download.swift.org/swift-${SWIFT_VERSION}-release/${SWIFT_PLATFORM_DIR}/swift-${SWIFT_VERSION}-RELEASE/swift-${SWIFT_VERSION}-RELEASE-${SWIFT_PLATFORM}.tar.gz" \
    && tar xzf "swift-${SWIFT_VERSION}-RELEASE-${SWIFT_PLATFORM}.tar.gz" -C /opt \
    && ln -s "/opt/swift-${SWIFT_VERSION}-RELEASE-${SWIFT_PLATFORM}/usr/bin/swift" /usr/local/bin/swift \
    && ln -s "/opt/swift-${SWIFT_VERSION}-RELEASE-${SWIFT_PLATFORM}/usr/bin/sourcekit-lsp" /usr/local/bin/sourcekit-lsp \
    && rm "swift-${SWIFT_VERSION}-RELEASE-${SWIFT_PLATFORM}.tar.gz"

# SwiftLint (Linux release binary)
RUN ARCH=$(dpkg --print-architecture) \
    && SWIFTLINT_ARCH=amd64 \
    && if [ "$ARCH" = "arm64" ]; then SWIFTLINT_ARCH=arm64; fi \
    && wget -q "https://github.com/realm/SwiftLint/releases/latest/download/swiftlint_linux_${SWIFTLINT_ARCH}.zip" \
    && unzip -o "swiftlint_linux_${SWIFTLINT_ARCH}.zip" swiftlint -d /usr/local/bin \
    && rm "swiftlint_linux_${SWIFTLINT_ARCH}.zip"

# Deno (for Supabase Edge Functions)
RUN curl -fsSL https://deno.land/install.sh | sh -s -- --no-modify-path \
    && mv /root/.deno/bin/deno /usr/local/bin/deno

# Supabase CLI
RUN ARCH=$(dpkg --print-architecture) \
    && SUPABASE_ARCH=amd64 \
    && if [ "$ARCH" = "arm64" ]; then SUPABASE_ARCH=arm64; fi \
    && curl -fsSL -o /tmp/supabase.tar.gz "https://github.com/supabase/cli/releases/latest/download/supabase_linux_${SUPABASE_ARCH}.tar.gz" \
    && tar xzf /tmp/supabase.tar.gz -C /usr/local/bin supabase \
    && rm /tmp/supabase.tar.gz

# Vercel CLI (npm global)
RUN npm install -g vercel@latest

# Set up non-root user
USER node

# Install global packages
ENV NPM_CONFIG_PREFIX=/usr/local/share/npm-global
ENV PATH=$PATH:/usr/local/share/npm-global/bin

# Set the default shell to zsh rather than sh
ENV SHELL=/bin/zsh

# Set the default editor and visual
ENV EDITOR=nano
ENV VISUAL=nano

# Default powerline10k theme
ARG ZSH_IN_DOCKER_VERSION=1.2.0
RUN sh -c "$(wget -O- https://github.com/deluan/zsh-in-docker/releases/download/v${ZSH_IN_DOCKER_VERSION}/zsh-in-docker.sh)" -- \
  -p git \
  -p fzf \
  -a "source /usr/share/doc/fzf/examples/key-bindings.zsh" \
  -a "source /usr/share/doc/fzf/examples/completion.zsh" \
  -a "export PROMPT_COMMAND='history -a' && export HISTFILE=/commandhistory/.bash_history" \
  -x

# Install Claude
RUN npm install -g @anthropic-ai/claude-code@${CLAUDE_CODE_VERSION}

# Copy and set up firewall script
COPY init-firewall.sh /usr/local/bin/
USER root
RUN chmod +x /usr/local/bin/init-firewall.sh && \
  echo "node ALL=(root) NOPASSWD: /usr/local/bin/init-firewall.sh" > /etc/sudoers.d/node-firewall && \
  chmod 0440 /etc/sudoers.d/node-firewall
USER node
