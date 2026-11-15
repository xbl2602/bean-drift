# Empirical temperature cycle and comparison candidate controls

- Date: 2026-11-15
- Owner: ShanLe1224
- Scope: product display model and UI only; shared core data/APIs unchanged.

This supersedes the instantaneous temperature approach recorded in 2026-11-15_ShanLe1224_click-site-data-and-layer-transitions.md. A fixed night baseline and a globally clipped illumination term created the hard boundary reported by the user.

Temperature now uses an adaptation of the Diviner-fit analytic cycle in Hurley et al. (2014), DOI https://doi.org/10.1016/j.icarus.2014.08.043 (open manuscript: https://ntrs.nasa.gov/api/citations/20150010748/downloads/20150010748.pdf). The published daytime fit and nighttime polynomial provide a practical, observation-based approximation to heating and cooling. This is not a direct temperature dataset or a numerical soil heat-conduction solver.

Adaptations are explicit: match the published night polynomial endpoints to 130 K at dusk and 95 K at dawn; taper the daytime baseline toward the colder dawn endpoint; apply the latitude correction continuously; orient an effective facet with the existing LOLA normal in Sun-state coordinates derived from the shared ephemeris vector. Five-point normal quadrature with the paper's 4.5-degree effective roughness averages emitted radiance (T^4), rather than blurring colour pixels. Permanent-shadow fractions retain a 55 K illustrative component in radiative power. Thermal/ice scores use a conservative peak on the same adapted cycle.

These adaptations have not been calibrated against individual Diviner pixels and do not inherit the paper's quoted accuracy. Resolved normals are an effective-facet approximation, not full terrain shadowing. Rock abundance, composition, actual subsurface conduction and seasonal thermal history are not resolved. The terminator and poles remain the least reliable regions; the UI says model, not measured. Actual small-scale sharp thermal contrasts can still occur.

CPU readouts and GPU colours share parameters, quadrature and matching formulas. The temperature shader bypasses the monthly illumination loop. Regression coverage includes cyclic continuity, cooling range/trend, facet bounds, permanent shadows and slope response.

Location details retain Stand here / Add site and no Compare footer. Compare Landing Sites opens existing candidates directly, or starts point selection when empty. Clear all sites empties the session candidate list and selected/draft marker, leaving the comparison drawer open in its empty state. Existing per-site removal stays available.

Latest main 14e0b29 was fast-forwarded before these edits; all pending work was preserved in a named stash and restored without conflicts.
