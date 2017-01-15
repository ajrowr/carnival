# Carnival Framework

___Carnival is currently undergoing heavy metamorphosis & refactoring as it transitions from 0.1 to 0.2. I'll start working on documentation soon :-]___

Carnival is a standalone WebVR framework for Javascript. It is currently in the pre-Beta phase of development.

The goal of Carnival is to make it easy to build web-connected spatial applications. Realistic graphics and physics are not a high priority at the moment, but we do have dynamic point lights and a few other graphical niceties, as well as the ability to load 3d meshes from .OBJ and .STL formats.

Carnival started out as an experiment in May of '16 but has been evolving into a useful and capable framework. The main thrust of the ongoing transition is toward a component-based architecture that allows maximum ease and flexibility in composition of an application. The goal is to be able to instanciate components (written in Javascript and dynamically loaded as needed) and wire them together using persistable metadata to build tools, toys and places from inside VR; kind of like you can with Redstone in Minecraft. I want for the building of things in VR to be accessible to young and old, coder and non-coder alike, and the Carnival framework is the nexus point of my roadmap. Meanwhile, lower-level APIs will remain available for those that want to dig deeper.

This is currently a one-person project (I'm basically your typical everyday VR-obsessed geek). If you want to talk, I can be reached via Twitter: http://twitter.com/ajrowr 

## What VR platforms does Carnival support?

All development so far has occurred on an HTC Vive. Besides that, the priority is to support all platforms that have spatial controllers, eg Oculus Touch and Google Daydream.

## How do I make something with Carnival?

I'm working on a bunch of standard components, and an updated version of the example file which will use the component architecture. Please watch this space :-}

If you want to check out something pre-component-architecture have a look at http://meta4vr.net/carnival/boilerplate . And if you need the old framework code it's in _lib/v/0.1_ in this repo.

