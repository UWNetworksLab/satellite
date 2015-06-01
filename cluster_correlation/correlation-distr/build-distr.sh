#!/bin/bash
curl http://www.ling.ohio-state.edu/~melsner/resources/correlation-distr.tgz | tar xz -C ..
mkdir lib64 bin64
patch Makefile -i Makefile.patch
make chainedSolvers