import org.springframework.boot.gradle.plugin.SpringBootPlugin

plugins {
    kotlin("jvm") version "{{kotlinVersion}}"
    // Opens Spring-annotated classes such as @Agent and @Component.
    kotlin("plugin.spring") version "{{kotlinVersion}}"
    id("org.springframework.boot") version "{{springBootVersion}}"
}

group = "{{groupId}}"
version = "0.1.0-SNAPSHOT"
description = "Embabel agent application (Kotlin)"

kotlin {
    jvmToolchain({{javaVersion}})
    compilerOptions {
        // Parameter names are needed at runtime by Spring and by Embabel's planner.
        javaParameters = true
        freeCompilerArgs.add("-Xjsr305=strict")
    }
}

repositories {
    mavenCentral()
}

// One version for ALL com.embabel.agent artifacts. Never mix versions.
val embabelAgentVersion = "{{embabelAgentVersion}}"

dependencies {
    implementation(platform(SpringBootPlugin.BOM_COORDINATES))
    implementation("org.jetbrains.kotlin:kotlin-reflect")

    implementation("com.embabel.agent:embabel-agent-starter:$embabelAgentVersion")
    // Interactive shell for trying the agent locally. Remove for a server-only app.
    implementation("com.embabel.agent:embabel-agent-starter-shell:$embabelAgentVersion")

    // FakeOperationContext, FakePromptRunner, EmbabelMockitoIntegrationTest
    testImplementation("com.embabel.agent:embabel-agent-test:$embabelAgentVersion")
    testImplementation("org.springframework.boot:spring-boot-starter-test")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")

    // LLM provider starters. Pick the provider(s) you actually use.
    // The first three are added when the matching API key is in the environment;
    // Ollama is opt-in: ./gradlew -Pollama bootRun
    // Keys come from the environment (see .env.sample). Never commit keys.
    mapOf(
        "OPENAI_API_KEY" to "openai",
        "ANTHROPIC_API_KEY" to "anthropic",
        "OPENAI_CUSTOM_API_KEY" to "openai-custom",
    ).forEach { (key, provider) ->
        if (providers.environmentVariable(key).isPresent) {
            implementation("com.embabel.agent:embabel-agent-starter-$provider:$embabelAgentVersion")
        }
    }
    if (providers.gradleProperty("ollama").isPresent) {
        implementation("com.embabel.agent:embabel-agent-starter-ollama:$embabelAgentVersion")
    }
}

tasks.test {
    useJUnitPlatform()
}

tasks.bootRun {
    // The Embabel shell reads commands from the terminal.
    standardInput = System.`in`
}
