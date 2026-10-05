plugins {
    // Downloads the JDK named in the toolchain when it is not installed locally.
    id("org.gradle.toolchains.foojay-resolver-convention") version "{{foojayResolverVersion}}"
}

rootProject.name = "{{artifactId}}"
