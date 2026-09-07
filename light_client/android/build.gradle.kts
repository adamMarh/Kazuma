allprojects {
    repositories {
        google()
        mavenCentral()
    }
}

val newBuildDir: Directory =
    rootProject.layout.buildDirectory
        .dir("../../build")
        .get()
rootProject.layout.buildDirectory.value(newBuildDir)

subprojects {
    val newSubprojectBuildDir: Directory = newBuildDir.dir(project.name)
    project.layout.buildDirectory.value(newSubprojectBuildDir)
}
subprojects {
    project.evaluationDependsOn(":app")
}

subprojects {
    val fixNamespace: (Project) -> Unit = { proj ->
        val android = proj.extensions.findByName("android")
        if (android is com.android.build.gradle.BaseExtension) {
            if (android.namespace.isNullOrEmpty()) {
                val manifest = proj.file("src/main/AndroidManifest.xml")
                if (manifest.exists()) {
                    val pkg = javax.xml.parsers.DocumentBuilderFactory.newInstance()
                        .newDocumentBuilder()
                        .parse(manifest)
                        .documentElement
                        .getAttribute("package")
                    if (pkg.isNotEmpty()) {
                        android.namespace = pkg
                    }
                }
            }
        }
    }

    if (project.state.executed) {
        fixNamespace(project)
    } else {
        afterEvaluate { fixNamespace(project) }
    }

    // Suppress "source/target value 8 is obsolete" warnings from plugin builds.
    tasks.whenTaskAdded {
        if (this is JavaCompile) {
            (this as JavaCompile).options.compilerArgs.add("-Xlint:-options")
        }
    }
}

tasks.register<Delete>("clean") {
    delete(rootProject.layout.buildDirectory)
}
