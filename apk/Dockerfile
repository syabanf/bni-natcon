# APK builder environment — Node + JDK 17 + Android SDK + Bubblewrap (TWA)
FROM node:20-bookworm

RUN apt-get update && apt-get install -y --no-install-recommends \
    openjdk-17-jdk-headless unzip curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ENV ANDROID_HOME=/opt/android-sdk
ENV PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools

RUN mkdir -p $ANDROID_HOME/cmdline-tools \
    && curl -fsSLo /tmp/ct.zip https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip \
    && unzip -q /tmp/ct.zip -d $ANDROID_HOME/cmdline-tools \
    && mv $ANDROID_HOME/cmdline-tools/cmdline-tools $ANDROID_HOME/cmdline-tools/latest \
    && rm /tmp/ct.zip

RUN yes | sdkmanager --licenses > /dev/null 2>&1 || true
RUN sdkmanager "platform-tools" "platforms;android-33" "platforms;android-35" "platforms;android-36" "build-tools;33.0.2" "build-tools;35.0.0" "build-tools;36.1.0"

RUN npm install -g @bubblewrap/cli

# Bubblewrap menerima SDK layout lama (tools/ atau bin/ di root) — buat dir real
# + wrapper script (bukan symlink: script sdkmanager tidak resolve symlink)
RUN rm -f /opt/android-sdk/bin && mkdir -p /opt/android-sdk/bin && \
    printf '#!/bin/sh\nexec /opt/android-sdk/cmdline-tools/latest/bin/sdkmanager "$@"\n' > /opt/android-sdk/bin/sdkmanager && \
    printf '#!/bin/sh\nexec /opt/android-sdk/cmdline-tools/latest/bin/avdmanager "$@"\n' > /opt/android-sdk/bin/avdmanager && \
    chmod +x /opt/android-sdk/bin/sdkmanager /opt/android-sdk/bin/avdmanager

WORKDIR /app
